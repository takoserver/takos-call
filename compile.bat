@echo off
tsc main.ts
if exist main.cjs del main.cjs
ren main.js main.cjs
echo コンパイル完了: main.cjs が生成されました