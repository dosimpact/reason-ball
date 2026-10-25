/*
 * OpenUI 프롬프트 생성용 진입점입니다. UI 라이브러리와 출력 옵션을 내보내며, 생성 결과는 백엔드에 명시적으로 전달합니다.
 */
/**
 * Entry point for the OpenUI CLI spec generator.
 *
 * `npm run generate` bundles
 * this file (stubbing asset imports) and reads the `library` + `promptOptions`
 * exports to write `src/generated/system-prompt.txt` and its spec.
 */
export {
  openuiLibrary as library,
  openuiPromptOptions as promptOptions,
} from "@openuidev/react-ui/genui-lib";
