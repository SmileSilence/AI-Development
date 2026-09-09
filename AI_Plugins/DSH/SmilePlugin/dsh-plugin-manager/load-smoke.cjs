const fs = require("fs");
const code = fs.readFileSync("D:\\Work\\AI-Development\\AI_Plugins\\DSH\\SmilePlugin\\dsh-plugin-manager\\\\lib\\\\client.js", "utf8");
const stubRequire = (id) => {
  if (id === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
  if (id === "react") return { useState: () => [null, () => {}], useEffect: () => {}, useMemo: (f) => f(), useCallback: (f) => f, useRef: () => ({ current: null }) };
  if (id === "@deepseek-ai/dsh-client-ui-primitives") return {};
  throw new Error("unexpected require: " + id);
};
let specOut = null;
const mockWindow = { __ModuleLoader__: { load: (spec) => { specOut = spec; } } };
const compile = new Function("window", "console", "require", code);
compile(mockWindow, console, stubRequire);
if (specOut === null || typeof specOut.factory !== "function") { console.error("FAIL: no factory"); process.exit(1); }
const result = specOut.factory(stubRequire);
console.log("exports:", Object.keys(result).join(","));
if (typeof result.apply !== "function") { console.error("FAIL: no apply"); process.exit(1); }
const registrations = [];
const ctx = {
  locale: { bind: () => (key, params) => key, register: () => {} },
  remote: { $mount: async (contribution) => {
    const ids = contribution.descriptors.map((d) => d.id);
    console.log("CONTRIBUTION descriptors:", contribution.package, ids.length, JSON.stringify(ids));
    return {};
  } },
  slots: { inject: (name, fn) => { const reg = fn(); registrations.push({ name, reg }); return () => {}; }, register: (meta, Component) => ({ meta, Component }) },
  effect: (fn, label) => { const out = fn(); return () => {}; },
  get: (key) => { if (key === "sessions") return {}; return null; },
};
(async () => {
  try { await result.apply(ctx, {}); } catch (e) { console.error("APPLY FAILED:", e && e.stack ? e.stack : e); process.exit(1); }
  console.log("apply() OK; registrations:");
  for (const { name, reg } of registrations) console.log("  ", name, "->", reg.meta.id, "order=" + reg.meta.order, "label=" + (typeof reg.meta.label === "function" ? reg.meta.label() : reg.meta.label), "locale=" + reg.meta.locale, "hasInject=" + (typeof reg.meta.inject === "function"), "hasComponent=" + (typeof reg.Component === "function"));
  const pluginReg = registrations.find((r) => r.name === "settings.plugins.tab");
  if (!pluginReg) { console.error("FAIL: settings.plugins.tab not registered"); process.exit(1); }
  const face = pluginReg.reg.meta.inject();
  console.log("plugin face methods:", Object.keys(face).join(","));
  console.log("SMOKE PASS");
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });