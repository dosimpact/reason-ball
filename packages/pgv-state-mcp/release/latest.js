#!/usr/bin/env node
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// src/lib/files.ts
var require_files = __commonJS({
  "src/lib/files.ts"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var fsPromises = require("fs/promises");
    var path = require("path");
    async function fileExists(filePath) {
      try {
        await fsPromises.access(filePath, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    }
    async function ensureDir(dirPath) {
      await fsPromises.mkdir(dirPath, { recursive: true });
    }
    async function readJsonFile(filePath) {
      return JSON.parse(await fsPromises.readFile(filePath, "utf-8"));
    }
    async function writeJsonFile(filePath, data) {
      await ensureDir(path.dirname(filePath));
      await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    }
    async function writeTextFile(filePath, text, options = {}) {
      await ensureDir(path.dirname(filePath));
      if (options.overwrite === false && await fileExists(filePath)) {
        return false;
      }
      await fsPromises.writeFile(filePath, text, "utf-8");
      return true;
    }
    async function moveFile(sourcePath, targetPath) {
      await ensureDir(path.dirname(targetPath));
      await fsPromises.rename(sourcePath, targetPath);
    }
    module2.exports = {
      ensureDir,
      fileExists,
      moveFile,
      readJsonFile,
      writeJsonFile,
      writeTextFile
    };
  }
});

// src/lib/state.ts
var require_state = __commonJS({
  "src/lib/state.ts"(exports2, module2) {
    "use strict";
    var path = require("path");
    var { ensureDir, fileExists, readJsonFile, writeJsonFile } = require_files();
    var DOCS_DIR = ".apb-workspace/docs";
    var STATUS_FILE = ".apb-workspace/docs/.apb-status.json";
    var PHASES = ["plan", "gradate", "validate"];
    function getStatusPath(projectDir) {
      return path.join(projectDir, STATUS_FILE);
    }
    function getDocsDir(projectDir) {
      return path.join(projectDir, DOCS_DIR);
    }
    function getDefaultStatus() {
      return {
        version: "1.0",
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
        activeFeatures: [],
        primaryFeature: null,
        features: {},
        history: []
      };
    }
    async function initializeWorkspace(projectDir) {
      await ensureDir(path.join(projectDir, DOCS_DIR, "01-plan"));
      await ensureDir(path.join(projectDir, DOCS_DIR, "02-gradate"));
      await ensureDir(path.join(projectDir, DOCS_DIR, "03-validate"));
      await ensureDir(path.join(projectDir, DOCS_DIR, "99-archive"));
      const statusPath = getStatusPath(projectDir);
      const existed = await fileExists(statusPath);
      if (!existed) {
        await writeStatus(projectDir, getDefaultStatus());
      }
      return { statusPath, existed, status: await readStatus(projectDir) };
    }
    async function readStatus(projectDir) {
      const statusPath = getStatusPath(projectDir);
      if (!await fileExists(statusPath)) {
        return getDefaultStatus();
      }
      return readJsonFile(statusPath);
    }
    async function writeStatus(projectDir, status) {
      status.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      await writeJsonFile(getStatusPath(projectDir), status);
      return status;
    }
    async function ensureFeature(projectDir, feature, phase) {
      const status = await readStatus(projectDir);
      const existing = status.features[feature] || null;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (!existing) {
        status.features[feature] = {
          phase,
          status: phase,
          completedPhases: [],
          documents: {},
          createdAt: now,
          updatedAt: now
        };
        if (!status.activeFeatures.includes(feature)) {
          status.activeFeatures.push(feature);
        }
        if (!status.primaryFeature) {
          status.primaryFeature = feature;
        }
        status.history.push({ feature, to: phase, timestamp: now });
      } else {
        const previousPhase = existing.phase || null;
        existing.phase = phase;
        existing.status = phase;
        existing.updatedAt = now;
        if (previousPhase && previousPhase !== phase && !existing.completedPhases.includes(previousPhase)) {
          existing.completedPhases.push(previousPhase);
        }
        if (previousPhase !== phase) {
          status.history.push({ feature, from: previousPhase, to: phase, timestamp: now });
        }
      }
      return writeStatus(projectDir, status);
    }
    async function setFeatureDocument(projectDir, feature, phase, docPath) {
      const status = await readStatus(projectDir);
      if (!status.features[feature]) {
        await ensureFeature(projectDir, feature, phase);
        return setFeatureDocument(projectDir, feature, phase, docPath);
      }
      status.features[feature].documents[phase] = docPath;
      status.features[feature].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      return writeStatus(projectDir, status);
    }
    async function archiveFeature(projectDir, feature, archivedDocuments) {
      const status = await readStatus(projectDir);
      const existing = status.features[feature] || null;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (!existing) {
        status.features[feature] = {
          phase: "archived",
          status: "archived",
          completedPhases: PHASES.slice(),
          documents: archivedDocuments,
          createdAt: now,
          updatedAt: now,
          archivedAt: now
        };
      } else {
        const previousPhase = existing.phase || null;
        existing.phase = "archived";
        existing.status = "archived";
        existing.completedPhases = Array.from(/* @__PURE__ */ new Set([...existing.completedPhases || [], ...PHASES]));
        existing.documents = { ...existing.documents || {}, ...archivedDocuments };
        existing.updatedAt = now;
        existing.archivedAt = now;
        if (previousPhase !== "archived") {
          status.history.push({ feature, from: previousPhase, to: "archived", timestamp: now });
        }
      }
      status.activeFeatures = (status.activeFeatures || []).filter((activeFeature) => activeFeature !== feature);
      if (status.primaryFeature === feature) {
        status.primaryFeature = status.activeFeatures[0] || null;
      }
      return writeStatus(projectDir, status);
    }
    function getPhaseProgress(featureStatus) {
      return PHASES.map((phase) => {
        if (!featureStatus) return { phase, status: "pending" };
        if (featureStatus.phase === phase) return { phase, status: "active" };
        if ((featureStatus.completedPhases || []).includes(phase)) return { phase, status: "done" };
        const activeIndex = PHASES.indexOf(featureStatus.phase);
        const phaseIndex = PHASES.indexOf(phase);
        return { phase, status: phaseIndex < activeIndex ? "done" : "pending" };
      });
    }
    function relativeDocPath(phase, feature) {
      const dir = phase === "plan" ? "01-plan" : phase === "gradate" ? "02-gradate" : "03-validate";
      return `${DOCS_DIR}/${dir}/${feature}.${phase}.md`;
    }
    function relativeArchiveDocPath(feature, fileName) {
      return `${DOCS_DIR}/99-archive/${feature}/${fileName}`;
    }
    module2.exports = {
      DOCS_DIR,
      STATUS_FILE,
      PHASES,
      archiveFeature,
      ensureFeature,
      getDocsDir,
      getPhaseProgress,
      getStatusPath,
      initializeWorkspace,
      readStatus,
      relativeArchiveDocPath,
      relativeDocPath,
      setFeatureDocument,
      writeStatus
    };
  }
});

// src/tools/init.ts
var require_init = __commonJS({
  "src/tools/init.ts"(exports2, module2) {
    "use strict";
    var { initializeWorkspace, STATUS_FILE } = require_state();
    async function handler(args, context) {
      const projectDir = args.projectDir;
      if (!projectDir) {
        return { error: "projectDir is required" };
      }
      context.projectDir = projectDir;
      const result = await initializeWorkspace(projectDir);
      return {
        initialized: true,
        created: !result.existed,
        projectDir,
        statusFile: STATUS_FILE,
        status: result.status
      };
    }
    var definition = {
      name: "pgv_state_init",
      description: "Initialize PGV state workspace under .apb-workspace/docs for the current project.",
      inputSchema: {
        type: "object",
        properties: {
          projectDir: {
            type: "string",
            description: "Absolute path to the project root directory."
          }
        },
        required: ["projectDir"]
      }
    };
    module2.exports = { handler, definition };
  }
});

// src/tools/get-status.ts
var require_get_status = __commonJS({
  "src/tools/get-status.ts"(exports2, module2) {
    "use strict";
    var { fileExists } = require_files();
    var { getPhaseProgress, getStatusPath, readStatus, STATUS_FILE } = require_state();
    async function handler(args, context) {
      const projectDir = args.projectDir || context.projectDir;
      if (!projectDir) {
        return {
          exists: false,
          error: "Session not initialized. Call pgv_state_init with projectDir first, or pass projectDir."
        };
      }
      context.projectDir = projectDir;
      const statusPath = getStatusPath(projectDir);
      const exists = await fileExists(statusPath);
      if (!exists) {
        return {
          exists: false,
          statusFile: STATUS_FILE,
          suggestion: "Call pgv_state_init with the current projectDir."
        };
      }
      const status = await readStatus(projectDir);
      const feature = args.feature;
      if (feature) {
        const featureStatus = status.features[feature] || null;
        return {
          exists: true,
          feature,
          found: Boolean(featureStatus),
          status: featureStatus,
          progress: getPhaseProgress(featureStatus),
          documents: featureStatus ? featureStatus.documents : {}
        };
      }
      return {
        exists: true,
        activeFeatures: status.activeFeatures,
        primaryFeature: status.primaryFeature,
        features: status.features,
        statusFile: STATUS_FILE,
        lastUpdated: status.lastUpdated
      };
    }
    var definition = {
      name: "pgv_state_get_status",
      description: "Get current PGV status for the project or a specific feature.",
      inputSchema: {
        type: "object",
        properties: {
          projectDir: {
            type: "string",
            description: "Absolute path to the project root directory. Optional after init."
          },
          feature: {
            type: "string",
            description: "Feature name. If omitted, returns all tracked features."
          }
        }
      }
    };
    module2.exports = { handler, definition };
  }
});

// src/template/plan.md
var require_plan = __commonJS({
  "src/template/plan.md"(exports2, module2) {
    module2.exports = "# {{feature}} Plan\n\n## Goal\n\nDescribe the user-visible outcome this feature must deliver.\n\n## Scope\n\n- In scope:\n- Out of scope:\n\n## Verification\n\n- Implementation scope:\n- Public interfaces:\n- External dependencies:\n- Internal dependencies:\n- Risky areas:\n\n## Validation\n\n- Core behavior works as designed.\n\n### E2E \uC2DC\uB098\uB9AC\uC624\n\n- Given the feature is available, When the primary workflow is executed, Then the expected result is visible and persistent.\n\n## Skills\n\n### Gradate \uB2E8\uACC4\n\n- TBD\n\n### Validate \uB2E8\uACC4\n\n- TBD\n";
  }
});

// src/template/gradate.md
var require_gradate = __commonJS({
  "src/template/gradate.md"(exports2, module2) {
    module2.exports = "# {{feature}} Gradate\n\n## Design\n\nDescribe the implementation design that satisfies the plan.\n\n## Implementation Draft\n\n### Architecture Overview\n\nTBD\n\n### Modules\n\nTBD\n\n### Interfaces\n\nTBD\n\n### Dependencies\n\nTBD\n\n### Data Flow\n\nTBD\n\n## Gap Analysis (Pre-Validate)\n\n| Design Item | Implementation Evidence | Status |\n| --- | --- | --- |\n| TBD | TBD | Pending |\n\n## Implementation Notes\n\n- TBD\n";
  }
});

// src/template/validate.md
var require_validate = __commonJS({
  "src/template/validate.md"(exports2, module2) {
    module2.exports = "# {{feature}} Validate\n\n## Scope\n\nValidation report for the PGV feature.\n\n## Validation Checklist\n\n| Check | Result | Evidence |\n| --- | --- | --- |\n| Plan scenarios executed | SKIP | Pending execution |\n| Design implementation gap reviewed | SKIP | Pending gap analysis |\n\n## Gap Table\n\n| Plan/Design Item | Implementation Evidence | Result |\n| --- | --- | --- |\n| TBD | TBD | SKIP |\n\n## E2E Results\n\n- SKIP: No E2E result recorded yet.\n\n## Skill Usage Log\n\n- TBD\n\n## Action Items\n\n- TBD\n\n## Verdict\n\nSKIP\n";
  }
});

// src/lib/templates.ts
var require_templates = __commonJS({
  "src/lib/templates.ts"(exports2, module2) {
    "use strict";
    var templates = {
      plan: require_plan(),
      gradate: require_gradate(),
      validate: require_validate()
    };
    function renderTemplate(templateName, values) {
      const template = templates[templateName];
      return template.replace(/\{\{feature\}\}/g, values.feature);
    }
    function planTemplate(feature) {
      return renderTemplate("plan", { feature });
    }
    function gradateTemplate(feature) {
      return renderTemplate("gradate", { feature });
    }
    function validateTemplate(feature) {
      return renderTemplate("validate", { feature });
    }
    module2.exports = {
      planTemplate,
      gradateTemplate,
      validateTemplate
    };
  }
});

// src/tools/pgv-plan.ts
var require_pgv_plan = __commonJS({
  "src/tools/pgv-plan.ts"(exports2, module2) {
    "use strict";
    var path = require("path");
    var { fileExists, writeTextFile } = require_files();
    var { ensureFeature, initializeWorkspace, readStatus, relativeDocPath, setFeatureDocument } = require_state();
    var { planTemplate } = require_templates();
    async function handler(args, context) {
      const projectDir = args.projectDir || context.projectDir;
      const feature = args.feature;
      if (!projectDir) return { error: "projectDir is required. Call pgv_state_init first or pass projectDir." };
      if (!feature) return { error: "feature is required" };
      context.projectDir = projectDir;
      await initializeWorkspace(projectDir);
      const status = await readStatus(projectDir);
      const existing = status.features[feature] || null;
      const docPath = relativeDocPath("plan", feature);
      const absoluteDocPath = path.join(projectDir, docPath);
      if (existing && existing.status != null && await fileExists(absoluteDocPath)) {
        return {
          feature,
          phase: existing.phase,
          created: false,
          document: docPath,
          message: `Feature '${feature}' already exists; plan was not overwritten.`
        };
      }
      await writeTextFile(absoluteDocPath, planTemplate(feature), { overwrite: false });
      await ensureFeature(projectDir, feature, "plan");
      await setFeatureDocument(projectDir, feature, "plan", docPath);
      return {
        feature,
        phase: "plan",
        created: true,
        document: docPath,
        nextCommand: `apb-pgv plan-gradate ${feature}`
      };
    }
    var definition = {
      name: "pgv_state_pgv_plan",
      description: "Create or resume a PGV plan document for a feature and update PGV state.",
      inputSchema: {
        type: "object",
        properties: {
          projectDir: {
            type: "string",
            description: "Absolute path to the project root directory. Optional after init."
          },
          feature: {
            type: "string",
            description: "Feature name, preferably kebab-case."
          }
        },
        required: ["feature"]
      }
    };
    module2.exports = { handler, definition };
  }
});

// src/tools/pgv-gradate.ts
var require_pgv_gradate = __commonJS({
  "src/tools/pgv-gradate.ts"(exports2, module2) {
    "use strict";
    var path = require("path");
    var { fileExists, writeTextFile } = require_files();
    var { ensureFeature, initializeWorkspace, relativeDocPath, setFeatureDocument } = require_state();
    var { gradateTemplate } = require_templates();
    async function handler(args, context) {
      const projectDir = args.projectDir || context.projectDir;
      const feature = args.feature;
      if (!projectDir) return { error: "projectDir is required. Call pgv_state_init first or pass projectDir." };
      if (!feature) return { error: "feature is required" };
      context.projectDir = projectDir;
      await initializeWorkspace(projectDir);
      const planPath = path.join(projectDir, relativeDocPath("plan", feature));
      if (!await fileExists(planPath)) {
        return {
          error: `Plan document is missing for '${feature}'. Run apb-pgv plan ${feature} first.`,
          missingDocument: relativeDocPath("plan", feature)
        };
      }
      const docPath = relativeDocPath("gradate", feature);
      const created = await writeTextFile(path.join(projectDir, docPath), gradateTemplate(feature), { overwrite: false });
      await ensureFeature(projectDir, feature, "gradate");
      await setFeatureDocument(projectDir, feature, "gradate", docPath);
      return {
        feature,
        phase: "gradate",
        created,
        document: docPath,
        nextCommand: `apb-pgv validate ${feature}`
      };
    }
    var definition = {
      name: "pgv_state_pgv_gradate",
      description: "Create a PGV gradate document, transition the feature to gradate, and update PGV state.",
      inputSchema: {
        type: "object",
        properties: {
          projectDir: {
            type: "string",
            description: "Absolute path to the project root directory. Optional after init."
          },
          feature: {
            type: "string",
            description: "Feature name."
          }
        },
        required: ["feature"]
      }
    };
    module2.exports = { handler, definition };
  }
});

// src/tools/pgv-validate.ts
var require_pgv_validate = __commonJS({
  "src/tools/pgv-validate.ts"(exports2, module2) {
    "use strict";
    var path = require("path");
    var { fileExists, writeTextFile } = require_files();
    var { ensureFeature, initializeWorkspace, relativeDocPath, setFeatureDocument } = require_state();
    var { validateTemplate } = require_templates();
    async function handler(args, context) {
      const projectDir = args.projectDir || context.projectDir;
      const feature = args.feature;
      if (!projectDir) return { error: "projectDir is required. Call pgv_state_init first or pass projectDir." };
      if (!feature) return { error: "feature is required" };
      context.projectDir = projectDir;
      await initializeWorkspace(projectDir);
      const gradatePath = path.join(projectDir, relativeDocPath("gradate", feature));
      if (!await fileExists(gradatePath)) {
        return {
          error: `Gradate document is missing for '${feature}'. Run apb-pgv gradate ${feature} first.`,
          missingDocument: relativeDocPath("gradate", feature)
        };
      }
      const docPath = relativeDocPath("validate", feature);
      const created = await writeTextFile(path.join(projectDir, docPath), validateTemplate(feature), { overwrite: false });
      await ensureFeature(projectDir, feature, "validate");
      await setFeatureDocument(projectDir, feature, "validate", docPath);
      return {
        feature,
        phase: "validate",
        created,
        document: docPath,
        nextCommand: null
      };
    }
    var definition = {
      name: "pgv_state_pgv_validate",
      description: "Create a PGV validate report, transition the feature to validate, and update PGV state.",
      inputSchema: {
        type: "object",
        properties: {
          projectDir: {
            type: "string",
            description: "Absolute path to the project root directory. Optional after init."
          },
          feature: {
            type: "string",
            description: "Feature name."
          }
        },
        required: ["feature"]
      }
    };
    module2.exports = { handler, definition };
  }
});

// src/tools/pgv-archive.ts
var require_pgv_archive = __commonJS({
  "src/tools/pgv-archive.ts"(exports2, module2) {
    "use strict";
    var path = require("path");
    var { fileExists, moveFile } = require_files();
    var {
      PHASES,
      archiveFeature,
      initializeWorkspace,
      readStatus,
      relativeArchiveDocPath,
      relativeDocPath
    } = require_state();
    function timestampSuffix() {
      return (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    }
    async function getAvailableArchivePath(projectDir, feature, fileName) {
      let archivePath = relativeArchiveDocPath(feature, fileName);
      if (!await fileExists(path.join(projectDir, archivePath))) {
        return archivePath;
      }
      const parsed = path.parse(fileName);
      archivePath = relativeArchiveDocPath(feature, `${parsed.name}.${timestampSuffix()}${parsed.ext}`);
      return archivePath;
    }
    async function handler(args, context) {
      const projectDir = args.projectDir || context.projectDir;
      const feature = args.feature;
      if (!projectDir) return { error: "projectDir is required. Call pgv_state_init first or pass projectDir." };
      if (!feature) return { error: "feature is required" };
      context.projectDir = projectDir;
      await initializeWorkspace(projectDir);
      const status = await readStatus(projectDir);
      const featureStatus = status.features[feature] || null;
      if (!featureStatus) {
        return { error: `Feature '${feature}' is not tracked. Run apb-pgv plan ${feature} first.` };
      }
      const archivedDocuments = {};
      const moved = [];
      const missing = [];
      for (const phase of PHASES) {
        const currentDocPath = (featureStatus.documents || {})[phase] || relativeDocPath(phase, feature);
        const absoluteDocPath = path.join(projectDir, currentDocPath);
        if (!await fileExists(absoluteDocPath)) {
          missing.push({ phase, document: currentDocPath });
          continue;
        }
        const archiveDocPath = await getAvailableArchivePath(projectDir, feature, path.basename(currentDocPath));
        await moveFile(absoluteDocPath, path.join(projectDir, archiveDocPath));
        archivedDocuments[phase] = archiveDocPath;
        moved.push({ phase, from: currentDocPath, to: archiveDocPath });
      }
      if (moved.length === 0) {
        return {
          error: `No phase documents were found to archive for '${feature}'.`,
          feature,
          missing
        };
      }
      await archiveFeature(projectDir, feature, archivedDocuments);
      return {
        feature,
        phase: "archived",
        archived: true,
        moved,
        missing,
        documents: archivedDocuments
      };
    }
    var definition = {
      name: "pgv_state_pgv_archive",
      description: "Archive PGV plan, gradate, and validate documents for a feature and update PGV state.",
      inputSchema: {
        type: "object",
        properties: {
          projectDir: {
            type: "string",
            description: "Absolute path to the project root directory. Optional after init."
          },
          feature: {
            type: "string",
            description: "Feature name."
          }
        },
        required: ["feature"]
      }
    };
    module2.exports = { handler, definition };
  }
});

// src/tools/index.ts
var require_tools = __commonJS({
  "src/tools/index.ts"(exports2, module2) {
    "use strict";
    var tools = {
      pgv_state_init: require_init(),
      pgv_state_get_status: require_get_status(),
      pgv_state_pgv_plan: require_pgv_plan(),
      pgv_state_pgv_gradate: require_pgv_gradate(),
      pgv_state_pgv_validate: require_pgv_validate(),
      pgv_state_pgv_archive: require_pgv_archive()
    };
    function getToolDefinitions() {
      return Object.values(tools).map((tool) => tool.definition);
    }
    async function executeToolCall(name, args, context) {
      const tool = tools[name];
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }
      return tool.handler(args, context);
    }
    module2.exports = { getToolDefinitions, executeToolCall };
  }
});

// src/server.ts
var require_server = __commonJS({
  "src/server.ts"(exports2, module2) {
    "use strict";
    var { getToolDefinitions, executeToolCall } = require_tools();
    var PROTOCOL_VERSION = "2024-11-05";
    var SERVER_NAME = "pgv-state-mcp";
    var SERVER_VERSION = "0.1.0";
    function createServer2() {
      const state = {
        initialized: false,
        projectDir: null
      };
      async function handleRequest(request) {
        const { method, params, id } = request;
        if (id === void 0) {
          if (method === "notifications/initialized") {
            state.initialized = true;
            console.error("[pgv-state-mcp] Client initialized");
          }
          return null;
        }
        try {
          const result = await dispatch(method, params || {});
          return { jsonrpc: "2.0", id, result };
        } catch (err) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: err.code || -32603,
              message: err.message || "Internal error"
            }
          };
        }
      }
      async function dispatch(method, params) {
        switch (method) {
          case "initialize":
            return {
              protocolVersion: PROTOCOL_VERSION,
              serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
              capabilities: { tools: {} }
            };
          case "tools/list":
            return { tools: getToolDefinitions() };
          case "tools/call":
            return handleToolsCall(params);
          default: {
            const err = new Error(`Method not found: ${method}`);
            err.code = -32601;
            throw err;
          }
        }
      }
      async function handleToolsCall(params) {
        const { name, arguments: args } = params;
        if (!name) {
          const err = new Error("Missing tool name");
          err.code = -32602;
          throw err;
        }
        try {
          const result = await executeToolCall(name, args || {}, state);
          return {
            content: [{
              type: "text",
              text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
            }]
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
            isError: true
          };
        }
      }
      return { handleRequest, state };
    }
    module2.exports = { createServer: createServer2 };
  }
});

// index.ts
var { createServer } = require_server();
var server = createServer();
var buffer = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newlineIdx;
  while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlineIdx).trim();
    buffer = buffer.slice(newlineIdx + 1);
    if (!line) continue;
    let request;
    try {
      request = JSON.parse(line);
    } catch (err) {
      console.error(`[pgv-state-mcp] JSON parse error: ${err.message}`);
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error", data: err.message }
      }) + "\n");
      continue;
    }
    server.handleRequest(request).then((response) => {
      if (response) {
        process.stdout.write(JSON.stringify(response) + "\n");
      }
    }).catch((err) => {
      console.error(`[pgv-state-mcp] Error handling request: ${err.message}`);
      if (request.id !== void 0) {
        process.stdout.write(JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32603, message: "Internal error", data: err.message }
        }) + "\n");
      }
    });
  }
});
process.stdin.on("end", () => {
  console.error("[pgv-state-mcp] stdin closed, shutting down");
  process.exit(0);
});
process.on("uncaughtException", (err) => {
  console.error(`[pgv-state-mcp] Uncaught exception: ${err.message}`);
  process.exit(1);
});
console.error("[pgv-state-mcp] PGV state MCP server started (STDIO)");
