export default {
    locales: ["en", "de"],
    extract: {
        input: "src/**/*.{js,jsx,ts,tsx}",
        output: "src/locales/{{language}}/{{namespace}}.json",
    },
};
