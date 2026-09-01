export default {
    locales: ["en", "de", "ko-kr", "zh-cn"],
    extract: {
        input: "src/**/*.{js,jsx,ts,tsx}",
        output: "src/locales/{{language}}/{{namespace}}.json",
    },
};
