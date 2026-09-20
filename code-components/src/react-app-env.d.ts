/// <reference types="react-scripts" />

// react-scripts ne déclare que *.module.css (CSS Modules) ; nos composants
// importent du CSS "plain" en side-effect (import "./X.css") — TypeScript
// 7 (TS2882) est plus strict que les versions précédentes sur ce point.
declare module "*.css";
