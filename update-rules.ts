const rules = `## WebUI 开发质量规则

### 1. JSX/TSX 文件扩展名强制
含 JSX 语法的文件扩展名必须是 .tsx，不得是 .ts。

### 2. 第三方库 API 须核实，不得猜测
使用以下库前必须确认实际 prop / 方法签名：
- **MDEditor**（@uiw/react-md-editor）：onChange 签名为 (v?: string) => void，直接传 setState 会报类型错误，需包装：onChange={(v) => setState(v ?? "")}
- **ReactMarkdown**（react-markdown v10+）：不接受 className prop，需在外层包裹 <div className="...">
- **Radix Select**（@radix-ui/react-select）：无 multiple prop，多选场景需改用 checkbox list 或其他方案
- **sonner**：自定义内容用 toast.custom((id) => <JSX />, opts)，不是 toast({ render: ... }, opts)

### 3. 后端接口先确认再调用
前端调用 API 前，先核实 src/api.ts 中存在对应路由。若需新增接口（如 PATCH /projects/:id），必须在任务描述中明确说明并同步实现，不得用错误 workaround（例如用 POST 假装 PATCH、给不存在的字段赋值）。

### 4. 交付前必须通过 TypeScript 编译
每次提交前在 web/ 目录执行：
\`\`\`
npx tsc --noEmit
\`\`\`
零错误才算交付合格，有错误不得提交。

### 5. 截图验收
前端改动必须附带浏览器截图证明功能正常运行，不得仅凭代码推断交付完成。
`;

fetch('http://localhost:3141/api/projects/5fa54bc6-ab5f-4fed-bc1f-e3bcd6503569', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ rules }),
})
  .then(res => res.json())
  .then(data => {
    console.log('Success:', data);
    console.log('\\nRules updated successfully!');
    return fetch('http://localhost:3141/api/projects/5fa54bc6-ab5f-4fed-bc1f-e3bcd6503569');
  })
  .then(res => res.json())
  .then(project => {
    console.log('\\nUpdated project:');
    console.log(`ID: ${project.id}`);
    console.log(`Name: ${project.name}`);
    console.log('\\nRules content:');
    console.log(project.rules);
  })
  .catch(error => {
    console.error('Error:', error);
  });
