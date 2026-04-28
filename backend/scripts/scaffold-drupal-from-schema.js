#!/usr/bin/env node

/*
 * Generate Drupal config scaffolding from the v2 catalog schema.
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

function parseNumber(value, fallback = 0) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInlineOptions(value) {
  const m = value.match(/^\[(.*)\]$/);
  if (!m) return null;
  const inner = m[1].trim();
  if (!inner) return [];
  return inner.split(',').map((item) => unquote(item.trim()));
}

function parseCatalogSchema(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  const schema = {
    version: 2,
    catalog: {
      reusable_bundles: [],
      application_bundles: [],
    },
    notes: [],
  };

  let topLevelSection = null;
  let currentBundleListName = null;
  let currentBundle = null;
  let currentSection = null;
  let currentField = null;
  let readingFieldOptions = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith('#')) continue;

    const indent = raw.match(/^\s*/)[0].length;
    const line = raw.trim();

    if (indent === 0) {
      readingFieldOptions = false;
      currentBundleListName = null;
      currentBundle = null;
      currentSection = null;
      currentField = null;

      if (line.startsWith('version:')) {
        schema.version = parseNumber(line.slice('version:'.length), 2);
        continue;
      }

      if (line === 'catalog:') {
        topLevelSection = 'catalog';
        continue;
      }

      if (line === 'notes:') {
        topLevelSection = 'notes';
        continue;
      }

      topLevelSection = null;
      continue;
    }

    if (topLevelSection === 'notes') {
      if (indent === 2 && line.startsWith('- ')) {
        schema.notes.push(unquote(line.slice(2)));
      }
      continue;
    }

    if (topLevelSection !== 'catalog') continue;

    if (readingFieldOptions && indent === 16 && line.startsWith('- ')) {
      currentField.options.push(unquote(line.slice(2)));
      continue;
    }

    if (readingFieldOptions && indent <= 14) {
      readingFieldOptions = false;
    }

    if (indent === 2 && (line === 'reusable_bundles:' || line === 'application_bundles:')) {
      currentBundleListName = line.slice(0, -1);
      currentBundle = null;
      currentSection = null;
      currentField = null;
      continue;
    }

    if (!currentBundleListName) continue;

    if (indent === 4 && line.startsWith('- machine_name:')) {
      currentBundle = {
        machine_name: unquote(line.slice('- machine_name:'.length)),
        label: '',
        description: '',
        kind: '',
        form_id: '',
        base_bundle: '',
        sections: [],
      };
      schema.catalog[currentBundleListName].push(currentBundle);
      currentSection = null;
      currentField = null;
      continue;
    }

    if (!currentBundle) continue;

    if (indent === 6 && line.startsWith('label:')) {
      currentBundle.label = unquote(line.slice('label:'.length));
      continue;
    }
    if (indent === 6 && line.startsWith('description:')) {
      currentBundle.description = unquote(line.slice('description:'.length));
      continue;
    }
    if (indent === 6 && line.startsWith('kind:')) {
      currentBundle.kind = unquote(line.slice('kind:'.length));
      continue;
    }
    if (indent === 6 && line.startsWith('form_id:')) {
      currentBundle.form_id = unquote(line.slice('form_id:'.length));
      continue;
    }
    if (indent === 6 && line.startsWith('base_bundle:')) {
      currentBundle.base_bundle = unquote(line.slice('base_bundle:'.length));
      continue;
    }
    if (indent === 6 && line.startsWith('sections:')) {
      continue;
    }

    if (indent === 8 && line.startsWith('- id:')) {
      currentSection = {
        id: unquote(line.slice('- id:'.length)),
        title: '',
        description: '',
        fields: [],
      };
      currentBundle.sections.push(currentSection);
      currentField = null;
      continue;
    }

    if (!currentSection) continue;

    if (indent === 10 && line.startsWith('title:')) {
      currentSection.title = unquote(line.slice('title:'.length));
      continue;
    }
    if (indent === 10 && line.startsWith('description:')) {
      currentSection.description = unquote(line.slice('description:'.length));
      continue;
    }
    if (indent === 10 && line.startsWith('fields:')) {
      continue;
    }

    if (indent === 12 && line.startsWith('- key:')) {
      currentField = {
        key: unquote(line.slice('- key:'.length)),
        label: '',
        type: 'text',
        required: false,
        options: [],
        description: '',
      };
      currentSection.fields.push(currentField);
      continue;
    }

    if (!currentField || indent !== 14) continue;

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
    if (line.startsWith('description:')) {
      currentField.description = unquote(line.slice('description:'.length));
      continue;
    }
    if (line.startsWith('contact_kind:')) {
      currentField.contact_kind = unquote(line.slice('contact_kind:'.length));
      continue;
    }
    if (line.startsWith('cardinality:')) {
      currentField.cardinality = parseNumber(line.slice('cardinality:'.length), 1);
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

function parseSchema(text) {
  const hasCatalog = text.includes('catalog:');
  const hasReusableBundles = text.includes('reusable_bundles:');
  const hasApplicationBundles = text.includes('application_bundles:');

  if (!hasCatalog || (!hasReusableBundles && !hasApplicationBundles)) {
    throw new Error('Unsupported schema format. This script only supports schema v2 catalog format.');
  }

  return parseCatalogSchema(text);
}

function mergeCatalogSchemas(parsedSchemas) {
  const merged = {
    version: 2,
    catalog: {
      reusable_bundles: [],
      application_bundles: [],
    },
    notes: [],
  };

  parsedSchemas.forEach((schema) => {
    if (Number.isFinite(Number(schema.version))) {
      merged.version = Math.max(merged.version, Number(schema.version));
    }

    merged.catalog.reusable_bundles.push(...(schema.catalog?.reusable_bundles || []));
    merged.catalog.application_bundles.push(...(schema.catalog?.application_bundles || []));
    merged.notes.push(...(schema.notes || []));
  });

  return merged;
}

function loadSchema(schemaInputPath) {
  const stat = fs.statSync(schemaInputPath);

  if (stat.isDirectory()) {
    const files = fs
      .readdirSync(schemaInputPath)
      .filter((name) => /\.ya?ml$/i.test(name))
      .sort((a, b) => a.localeCompare(b));

    if (files.length === 0) {
      throw new Error(`No schema YAML files found in directory: ${schemaInputPath}`);
    }

    const parsedSchemas = files.map((name) => {
      const filePath = path.join(schemaInputPath, name);
      return parseSchema(fs.readFileSync(filePath, 'utf8'));
    });

    return mergeCatalogSchemas(parsedSchemas);
  }

  return parseSchema(fs.readFileSync(schemaInputPath, 'utf8'));
}

function normalizeSchema(parsedSchema) {
  const reusableBundles = parsedSchema.catalog.reusable_bundles || [];
  const applicationBundles = parsedSchema.catalog.application_bundles || [];

  return {
    version: parsedSchema.version || 2,
    bundles: [...reusableBundles, ...applicationBundles].map((bundle) => ({
      machine_name: normalizeMachineName(bundle.machine_name || bundle.label || 'application'),
      label: bundle.label || bundle.machine_name || 'Application',
      description: bundle.description || 'Generated from form schema catalog',
      kind: bundle.kind || 'bundle',
      form_id: bundle.form_id || '',
      base_bundle: bundle.base_bundle ? normalizeMachineName(bundle.base_bundle) : '',
      sections: Array.isArray(bundle.sections) ? bundle.sections : [],
    })),
  };
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
      storageSettings: { max_length: 64, is_ascii: false, case_sensitive: false },
      instanceSettings: {},
    };
  }

  if (type === 'typed_contact_list') {
    return {
      storageType: 'string',
      module: 'core',
      storageSettings: { max_length: 255, is_ascii: false, case_sensitive: false },
      instanceSettings: {},
    };
  }

  if (type === 'address_reference') {
    return {
      storageType: 'entity_reference',
      module: 'core',
      storageSettings: { target_type: 'node' },
      instanceSettings: {
        handler: 'default:node',
        handler_settings: {
          target_bundles: {
            address: 'address',
          },
          sort: {
            field: '_none',
          },
          auto_create: false,
          auto_create_bundle: '',
        },
      },
      translatable: true,
      configDependencies: ['node.type.address'],
    };
  }

  if (type === 'person_reference') {
    return {
      storageType: 'entity_reference',
      module: 'core',
      storageSettings: { target_type: 'node' },
      instanceSettings: {
        handler: 'default:node',
        handler_settings: {
          target_bundles: {
            person: 'person',
          },
          sort: {
            field: '_none',
          },
          auto_create: false,
          auto_create_bundle: '',
        },
      },
      translatable: true,
      configDependencies: ['node.type.person'],
    };
  }

  if (type === 'student_profile_reference') {
    return {
      storageType: 'entity_reference',
      module: 'core',
      storageSettings: { target_type: 'node' },
      instanceSettings: {
        handler: 'default:node',
        handler_settings: {
          target_bundles: {
            student_profile: 'student_profile',
          },
          sort: {
            field: '_none',
          },
          auto_create: false,
          auto_create_bundle: '',
        },
      },
      translatable: true,
      configDependencies: ['node.type.student_profile'],
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

function buildNodeTypeConfig(bundle) {
  return {
    langcode: 'en',
    status: true,
    dependencies: {
      module: ['node'],
    },
    name: bundle.label || 'Application',
    type: bundle.machine_name || 'application',
    description: bundle.description || 'Generated application content type',
    help: '',
    new_revision: false,
    preview_mode: 1,
    display_submitted: false,
  };
}

function buildStorageConfig(fieldName, mapping, field) {
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
    cardinality: Number.isInteger(field.cardinality) ? field.cardinality : 1,
    translatable: Boolean(mapping.translatable),
    indexes: {},
    persist_with_no_fields: false,
    custom_storage: false,
  };
}

function buildInstanceConfig(bundle, fieldName, field, mapping, section) {
  const required = Boolean(field.required);
  const configDependencies = [`field.storage.node.${fieldName}`, `node.type.${bundle}`];

  let description = field.description || (section ? `Section: ${section.title}` : '');
  if (!description && field.type === 'typed_contact_list' && field.contact_kind) {
    description = `Store one ${field.contact_kind} per line using type:value formatting.`;
  }

  if (Array.isArray(mapping.configDependencies)) {
    configDependencies.push(...mapping.configDependencies);
  }

  return {
    langcode: 'en',
    status: true,
    dependencies: {
      config: configDependencies,
    },
    id: `node.${bundle}.${fieldName}`,
    field_name: fieldName,
    entity_type: 'node',
    bundle,
    label: field.label,
    description,
    required,
    translatable: false,
    default_value: {},
    default_value_callback: '',
    settings: mapping.instanceSettings,
    field_type: mapping.storageType,
  };
}

function collectBundleFieldEntries(bundle, bundleMap, visited = new Set()) {
  const bundleId = bundle.machine_name;
  if (visited.has(bundleId)) {
    throw new Error(`Circular base_bundle chain detected for bundle: ${bundleId}`);
  }

  const nextVisited = new Set(visited);
  nextVisited.add(bundleId);

  const inheritedEntries = [];
  if (bundle.base_bundle) {
    const baseBundle = bundleMap.get(bundle.base_bundle);
    if (!baseBundle) {
      throw new Error(`Bundle ${bundle.machine_name} references missing base_bundle ${bundle.base_bundle}`);
    }

    inheritedEntries.push(...collectBundleFieldEntries(baseBundle, bundleMap, nextVisited));
  }

  const ownEntries = (bundle.sections || []).flatMap((section) =>
    (section.fields || []).map((field) => ({ section, field }))
  );

  return [...inheritedEntries, ...ownEntries];
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  const defaultSchemaCandidates = [
    path.resolve(__dirname, '..', 'schema', 'v2'),
    path.resolve(__dirname, '..', 'schema', 'application-form.schema-v2.yaml'),
    path.resolve(__dirname, '..', '..', 'backend', 'schema', 'v2'),
    path.resolve(__dirname, '..', '..', 'backend', 'schema', 'application-form.schema-v2.yaml'),
  ];

  const schemaPath = process.argv[2] || defaultSchemaCandidates.find((candidate) => fs.existsSync(candidate));
  const outputDir = process.argv[3] || path.resolve(__dirname, '..', 'config', 'generated');

  if (!schemaPath || !fs.existsSync(schemaPath)) {
    console.error('Schema path not found. Pass a v2 schema file or directory explicitly, e.g. node backend/scripts/scaffold-drupal-from-schema.js backend/schema/v2');
    process.exit(1);
  }

  const normalizedSchema = normalizeSchema(loadSchema(schemaPath));
  if (!Array.isArray(normalizedSchema.bundles) || normalizedSchema.bundles.length === 0) {
    console.error('No bundles found in schema input.');
    process.exit(1);
  }

  ensureDir(outputDir);

  const bundleMap = new Map(normalizedSchema.bundles.map((bundle) => [bundle.machine_name, bundle]));
  const writtenFields = new Set();
  const writtenBundles = [];

  normalizedSchema.bundles.forEach((bundle) => {
    const nodeTypeFile = path.join(outputDir, `node.type.${bundle.machine_name}.yml`);
    fs.writeFileSync(nodeTypeFile, `${toYaml(buildNodeTypeConfig(bundle))}\n`, 'utf8');
    writtenBundles.push(bundle.machine_name);

    collectBundleFieldEntries(bundle, bundleMap).forEach(({ section, field }) => {
      const fieldName = buildFieldName(field.key || field.label || 'field');
      const mapping = mapFieldType(field);
      const storage = buildStorageConfig(fieldName, mapping, field);
      const instance = buildInstanceConfig(bundle.machine_name, fieldName, field, mapping, section);

      if (!writtenFields.has(fieldName)) {
        const storagePath = path.join(outputDir, `field.storage.node.${fieldName}.yml`);
        fs.writeFileSync(storagePath, `${toYaml(storage)}\n`, 'utf8');
        writtenFields.add(fieldName);
      }

      const instancePath = path.join(outputDir, `field.field.node.${bundle.machine_name}.${fieldName}.yml`);
      fs.writeFileSync(instancePath, `${toYaml(instance)}\n`, 'utf8');
    });
  });

  console.log(`Generated Drupal scaffold config in: ${outputDir}`);
  console.log(`Bundles: ${writtenBundles.join(', ')}`);
  console.log(`Fields: ${writtenFields.size}`);
}

main();
