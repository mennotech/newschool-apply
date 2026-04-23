#!/usr/bin/env node

/*
 * Generate Drupal config scaffolding from application-form.schema.yaml.
 *
 * Output:
 * - node.type.<bundle>.yml
 * - field.storage.node.field_<field>.yml
 * - field.field.node.<bundle>.field_<field>.yml
 *
 * This parser intentionally targets the current high-level schema format
 * to avoid adding dependencies.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function unquote(value) {
  const v = value.trim();
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseBool(value) {
  const v = value.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return Boolean(v);
}

function parseInlineOptions(value) {
  const m = value.match(/^\[(.*)\]$/);
  if (!m) return null;
  const inner = m[1].trim();
  if (!inner) return [];
  return inner.split(',').map((item) => unquote(item.trim()));
}

function parseSchema(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  const schema = {
    form_id: '',
    name: '',
    drupal: {
      entity_type: 'node',
      bundle: 'application',
      bundle_label: 'Application',
      bundle_description: 'Generated from form schema',
    },
    sections: [],
  };

  let inDrupal = false;
  let inSections = false;
  let currentSection = null;
  let currentField = null;
  let readingFieldOptions = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith('#')) continue;

    const indent = raw.match(/^\s*/)[0].length;
    const line = raw.trim();

    if (indent === 0 && line.startsWith('form_id:')) {
      schema.form_id = unquote(line.slice('form_id:'.length));
      continue;
    }
    if (indent === 0 && line.startsWith('name:')) {
      schema.name = unquote(line.slice('name:'.length));
      continue;
    }

    if (indent === 0 && line === 'drupal:') {
      inDrupal = true;
      inSections = false;
      continue;
    }
    if (indent === 0 && line === 'sections:') {
      inSections = true;
      inDrupal = false;
      continue;
    }

    if (inDrupal) {
      if (indent <= 0) {
        inDrupal = false;
      } else if (indent === 2 && line.includes(':')) {
        const idx = line.indexOf(':');
        const key = line.slice(0, idx).trim();
        const value = unquote(line.slice(idx + 1));
        if (key) schema.drupal[key] = value;
      }
      continue;
    }

    if (!inSections) continue;

    if (readingFieldOptions && indent === 10 && line.startsWith('- ')) {
      currentField.options.push(unquote(line.slice(2)));
      continue;
    }
    if (readingFieldOptions && indent <= 8) {
      readingFieldOptions = false;
    }

    if (indent === 2 && line.startsWith('- id:')) {
      currentSection = {
        id: unquote(line.slice('- id:'.length)),
        title: '',
        description: '',
        fields: [],
      };
      schema.sections.push(currentSection);
      currentField = null;
      continue;
    }

    if (!currentSection) continue;

    if (indent === 4 && line.startsWith('title:')) {
      currentSection.title = unquote(line.slice('title:'.length));
      continue;
    }
    if (indent === 4 && line.startsWith('description:')) {
      currentSection.description = unquote(line.slice('description:'.length));
      continue;
    }

    if (indent === 6 && line.startsWith('- key:')) {
      currentField = {
        key: unquote(line.slice('- key:'.length)),
        label: '',
        type: 'text',
        required: false,
        options: [],
      };
      currentSection.fields.push(currentField);
      continue;
    }

    if (!currentField || indent !== 8) continue;

    if (line.startsWith('label:')) {
      currentField.label = unquote(line.slice('label:'.length));
      continue;
    }
    if (line.startsWith('type:')) {
      currentField.type = unquote(line.slice('type:'.length));
      continue;
    }
    if (line.startsWith('required:')) {
      currentField.required = parseBool(line.slice('required:'.length));
      continue;
    }
    if (line.startsWith('options:')) {
      const rawOptions = line.slice('options:'.length).trim();
      if (!rawOptions) {
        readingFieldOptions = true;
        currentField.options = [];
      } else {
        const parsed = parseInlineOptions(rawOptions);
        currentField.options = parsed || [];
      }
    }
  }

  return schema;
}

function normalizeMachineName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildFieldName(key) {
  const normalized = normalizeMachineName(key);
  const prefixed = `field_${normalized}`;
  if (prefixed.length <= 32) return prefixed;

  const hash = crypto.createHash('md5').update(prefixed).digest('hex').slice(0, 6);
  const prefixBudget = 32 - (1 + hash.length);
  return `${prefixed.slice(0, prefixBudget)}_${hash}`;
}

function mapFieldType(field) {
  const type = (field.type || 'text').toLowerCase();

  if (type === 'textarea' || type === 'signature') {
    return {
      storageType: 'text_long',
      module: 'text',
      storageSettings: {},
      instanceSettings: {},
    };
  }

  if (type === 'email') {
    return {
      storageType: 'email',
      module: 'core',
      storageSettings: {},
      instanceSettings: {},
    };
  }

  if (type === 'date') {
    return {
      storageType: 'datetime',
      module: 'datetime',
      storageSettings: { datetime_type: 'date' },
      instanceSettings: {},
    };
  }

  if ((type === 'radio' || type === 'select') && Array.isArray(field.options) && field.options.length > 0) {
    return {
      storageType: 'list_string',
      module: 'options',
      storageSettings: {
        allowed_values: field.options.map((option) => ({ value: option, label: option })),
        allowed_values_function: '',
      },
      instanceSettings: {},
    };
  }

  if (type === 'phone') {
    return {
      storageType: 'string',
      module: 'core',
      storageSettings: { max_length: 32, is_ascii: false, case_sensitive: false },
      instanceSettings: {},
    };
  }

  return {
    storageType: 'string',
    module: 'core',
    storageSettings: { max_length: 255, is_ascii: false, case_sensitive: false },
    instanceSettings: {},
  };
}

function yamlScalar(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (value === null || value === undefined) return "''";

  const s = String(value);
  if (s === '') return "''";

  const needsQuotes = /[:#{}\[\],&*!?|<>='"%@`]|^\s|\s$/.test(s);
  if (!needsQuotes) return s;
  return `'${s.replace(/'/g, "''")}'`;
}

function toYaml(value, indent = 0) {
  const sp = ' '.repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return `${sp}[]`;
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          const nested = toYaml(item, indent + 2);
          const nestedLines = nested.split('\n');
          const first = nestedLines[0].trimStart();
          const rest = nestedLines.slice(1).join('\n');
          if (!rest) return `${sp}- ${first}`;
          return `${sp}- ${first}\n${rest}`;
        }
        return `${sp}- ${yamlScalar(item)}`;
      })
      .join('\n');
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return `${sp}{}`;

    return entries
      .map(([k, v]) => {
        if (v && typeof v === 'object') {
          const nested = toYaml(v, indent + 2);
          if (nested.trim() === '[]' || nested.trim() === '{}') {
            return `${sp}${k}: ${nested.trim()}`;
          }
          return `${sp}${k}:\n${nested}`;
        }
        return `${sp}${k}: ${yamlScalar(v)}`;
      })
      .join('\n');
  }

  return `${sp}${yamlScalar(value)}`;
}

function buildNodeTypeConfig(drupal, formName) {
  return {
    langcode: 'en',
    status: true,
    dependencies: {
      module: ['node'],
    },
    name: drupal.bundle_label || 'Application',
    type: drupal.bundle || 'application',
    description: drupal.bundle_description || formName || 'Generated application content type',
    help: '',
    new_revision: false,
    preview_mode: 1,
    display_submitted: false,
  };
}

function buildStorageConfig(fieldName, mapping) {
  const deps = ['node'];
  if (mapping.module !== 'core') deps.push(mapping.module);

  return {
    langcode: 'en',
    status: true,
    dependencies: {
      module: deps,
    },
    id: `node.${fieldName}`,
    field_name: fieldName,
    entity_type: 'node',
    type: mapping.storageType,
    settings: mapping.storageSettings,
    module: mapping.module,
    locked: false,
    cardinality: 1,
    translatable: false,
    indexes: {},
    persist_with_no_fields: false,
    custom_storage: false,
  };
}

function buildInstanceConfig(bundle, fieldName, field, mapping, section) {
  const required = bundle === 'application' ? false : Boolean(field.required);

  return {
    langcode: 'en',
    status: true,
    dependencies: {
      config: [`field.storage.node.${fieldName}`, `node.type.${bundle}`],
    },
    id: `node.${bundle}.${fieldName}`,
    field_name: fieldName,
    entity_type: 'node',
    bundle,
    label: field.label,
    description: section ? `Section: ${section.title}` : '',
    required,
    translatable: false,
    default_value: {},
    default_value_callback: '',
    settings: mapping.instanceSettings,
    field_type: mapping.storageType,
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  const defaultSchemaCandidates = [
    path.resolve(__dirname, '..', '..', 'form.schema.yaml'),
    path.resolve(__dirname, '..', '..', 'application-form.schema.yaml'),
  ];

  const schemaPath = process.argv[2] || defaultSchemaCandidates.find((candidate) => fs.existsSync(candidate));
  const outputDir = process.argv[3] || path.resolve(__dirname, '..', 'config', 'generated');

  if (!schemaPath || !fs.existsSync(schemaPath)) {
    console.error('Schema file not found. Pass a path explicitly, e.g. node backend/scripts/scaffold-drupal-from-schema.js application-form.schema.yaml');
    process.exit(1);
  }

  const schema = parseSchema(fs.readFileSync(schemaPath, 'utf8'));
  if (!Array.isArray(schema.sections) || schema.sections.length === 0) {
    console.error('No sections found in schema.');
    process.exit(1);
  }

  const drupal = schema.drupal || {};
  const entityType = drupal.entity_type || 'node';
  const bundle = normalizeMachineName(drupal.bundle || 'application');

  if (entityType !== 'node') {
    console.error(`Only entity_type=node is supported in this scaffold script. Received: ${entityType}`);
    process.exit(1);
  }

  ensureDir(outputDir);

  const nodeTypeFile = path.join(outputDir, `node.type.${bundle}.yml`);
  fs.writeFileSync(nodeTypeFile, `${toYaml(buildNodeTypeConfig(drupal, schema.name))}\n`, 'utf8');

  const writtenFields = new Set();

  schema.sections.forEach((section) => {
    (section.fields || []).forEach((field) => {
      const fieldName = buildFieldName(field.key || field.label || 'field');
      if (writtenFields.has(fieldName)) return;

      const mapping = mapFieldType(field);
      const storage = buildStorageConfig(fieldName, mapping);
      const instance = buildInstanceConfig(bundle, fieldName, field, mapping, section);

      const storagePath = path.join(outputDir, `field.storage.node.${fieldName}.yml`);
      const instancePath = path.join(outputDir, `field.field.node.${bundle}.${fieldName}.yml`);

      fs.writeFileSync(storagePath, `${toYaml(storage)}\n`, 'utf8');
      fs.writeFileSync(instancePath, `${toYaml(instance)}\n`, 'utf8');

      writtenFields.add(fieldName);
    });
  });

  console.log(`Generated Drupal scaffold config in: ${outputDir}`);
  console.log(`Bundle: ${bundle}`);
  console.log(`Fields: ${writtenFields.size}`);
}

main();
