import { createHighlighterCore, type CodeToHastOptionsCommon } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
const highlighter = createHighlighterCore({
 engine:createJavaScriptRegexEngine(),
 themes:[import("@shikijs/themes/github-dark"),import("@shikijs/themes/github-light")],
 langs:[import("@shikijs/langs/javascript"),import("@shikijs/langs/typescript"),import("@shikijs/langs/python"),import("@shikijs/langs/json"),import("@shikijs/langs/bash"),import("@shikijs/langs/html"),import("@shikijs/langs/css"),import("@shikijs/langs/markdown")],
});
const aliases:Record<string,string>={js:"javascript",jsx:"javascript",ts:"typescript",tsx:"typescript",py:"python",sh:"bash",shell:"bash",md:"markdown"};
export async function highlightCode(code:string,language="typescript",theme="github-light",transformers?:CodeToHastOptionsCommon["transformers"]){
 const instance=await highlighter;const lang=aliases[language] ?? language;const supported=instance.getLoadedLanguages().includes(lang);
 return instance.codeToHtml(code,{lang:supported ? lang : "text",theme:theme==="github-dark"?"github-dark":"github-light",transformers});
}

