// Ambient declaration for the pdf-parse inner entry point.
// pdf-parse ships no types for its `lib/pdf-parse.js` subpath; this
// shorthand declaration silences TS7016 (implicit any) for the dynamic
// import in server/onboarding-docs.ts. The import is already typed `any`
// at the call site.
declare module 'pdf-parse/lib/pdf-parse.js';
