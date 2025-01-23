declare module 'json-parse-better-errors' {
  function parse(text: string, reviver?: (key: any, value: any) => any): any;
  export default parse;
} 