const prompt = process.argv.at(-1) ?? "";
const match = prompt.match(/MOCK_SLEEP=(\d+)/);
const delay = match === null ? 50 : Number(match[1]);
if (prompt.includes("MOCK_QUESTION")) console.log("MAB_CALLBACK:question: 是否继续？");
await new Promise((resolvePromise) => setTimeout(resolvePromise, delay));
console.log(`模拟 Agent 已完成，等待 ${delay} 毫秒。`);
