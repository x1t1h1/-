import { readFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const sourcePath = path.join(projectRoot, 'src', 'data', 'course.ts')
const source = await readFile(sourcePath, 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  reportDiagnostics: true,
  fileName: sourcePath,
})
const syntaxErrors = (output.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error)
if (syntaxErrors.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(syntaxErrors, {
    getCanonicalFileName: value => value,
    getCurrentDirectory: () => projectRoot,
    getNewLine: () => '\n',
  }))
  process.exit(1)
}

// course.ts 是当前项目的静态数据模块。仅转译至内存，不生成或修改源码文件。
const { chapters, nodes, relations, resources, questions, learningPath } = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputText).toString('base64')}`
)
const errors = []
const warnings = []
const expect = (condition, message) => { if (!condition) errors.push(message) }
const isText = value => typeof value === 'string' && value.trim().length > 0

function collectIds(items, label) {
  expect(Array.isArray(items), `${label}必须是数组`)
  if (!Array.isArray(items)) return new Set()
  const ids = new Set()
  for (const item of items) {
    expect(item && isText(item.id), `${label}存在缺少 id 的项目`)
    if (!item?.id) continue
    expect(!ids.has(item.id), `${label}重复 id：${item.id}`)
    ids.add(item.id)
  }
  return ids
}

const chapterIds = collectIds(chapters, '章节')
const nodeIds = collectIds(nodes, '知识点')
collectIds(resources, '资源')
collectIds(questions, '题目')

for (const node of nodes) {
  expect(isText(node.title), `知识点 ${node.id} 缺少标题`)
  expect(chapterIds.has(node.chapterId), `知识点 ${node.id} 引用了不存在的章节 ${node.chapterId}`)
  expect(Number.isFinite(node.x) && Number.isFinite(node.y), `知识点 ${node.id} 的图谱坐标不是有限数值`)
}

for (const relation of relations) {
  expect(nodeIds.has(relation.source), `关系起点不存在：${relation.source}`)
  expect(nodeIds.has(relation.target), `关系终点不存在：${relation.target}`)
  expect(relation.source !== relation.target, `关系存在自引用：${relation.source}`)
  expect(['前置', '包含', '应用'].includes(relation.type), `关系 ${relation.source} → ${relation.target} 的类型无效`)
}

// 章节学习路径用于零基础学习顺序；这里保证覆盖完整、章节成组且不违反前置关系。
expect(Array.isArray(learningPath), '学习路径 learningPath 必须是数组')
if (Array.isArray(learningPath)) {
  expect(learningPath.length === nodes.length, `学习路径应包含 ${nodes.length} 个知识点，实际 ${learningPath.length} 个`)
  const pathIds = new Set(learningPath)
  expect(pathIds.size === learningPath.length, '学习路径存在重复知识点')
  for (const id of learningPath) expect(nodeIds.has(id), `学习路径包含不存在的知识点 ${id}`)
  for (const id of nodeIds) expect(pathIds.has(id), `学习路径缺少知识点 ${id}`)

  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const chapterSequence = []
  for (const id of learningPath) {
    const node = nodeById.get(id)
    if (!node) continue
    if (chapterSequence[chapterSequence.length - 1] !== node.chapterId) chapterSequence.push(node.chapterId)
  }
  expect(
    JSON.stringify(chapterSequence) === JSON.stringify(chapters.map(chapter => chapter.id)),
    '学习路径的章节分组必须连续且按 ch0–ch12 顺序排列',
  )

  const position = new Map(learningPath.map((id, index) => [id, index]))
  const prerequisiteRelations = relations.filter(relation => relation.type === '前置')
  for (const relation of prerequisiteRelations) {
    const sourcePosition = position.get(relation.source)
    const targetPosition = position.get(relation.target)
    if (sourcePosition !== undefined && targetPosition !== undefined) {
      expect(sourcePosition < targetPosition, `前置关系 ${relation.source} → ${relation.target} 的顺序与 learningPath 冲突`)
    }
  }

  const indegree = new Map(nodes.map(node => [node.id, 0]))
  const children = new Map(nodes.map(node => [node.id, []]))
  for (const relation of prerequisiteRelations) {
    children.get(relation.source)?.push(relation.target)
    indegree.set(relation.target, (indegree.get(relation.target) ?? 0) + 1)
  }
  const queue = nodes.filter(node => indegree.get(node.id) === 0).map(node => node.id)
  let visited = 0
  while (queue.length) {
    const id = queue.shift()
    visited += 1
    for (const child of children.get(id) ?? []) {
      indegree.set(child, (indegree.get(child) ?? 0) - 1)
      if (indegree.get(child) === 0) queue.push(child)
    }
  }
  expect(visited === nodes.length, '前置关系存在环，无法生成先修层级')
}

function checkReferences(item, label) {
  expect(chapterIds.has(item.chapterId), `${label} ${item.id} 引用了不存在的章节 ${item.chapterId}`)
  expect(Array.isArray(item.nodeIds) && (item.type === 'external' || item.nodeIds.length > 0), `${label} ${item.id} 未关联知识点`)
  for (const nodeId of item.nodeIds ?? []) expect(nodeIds.has(nodeId), `${label} ${item.id} 引用了不存在的知识点 ${nodeId}`)
}

for (const question of questions) {
  checkReferences(question, '题目')
  expect(isText(question.stem) && isText(question.explanation), `题目 ${question.id} 缺少题干或解析`)
  const type = question.type ?? 'single'
  expect(['single', 'multi', 'judge', 'fill'].includes(type), `题目 ${question.id} 的题型无效：${type}`)

  if (type === 'fill') {
    expect(Array.isArray(question.answers) && question.answers.length >= 1 && question.answers.every(item => isText(item) && item.trim().length > 0), `题目 ${question.id} 的填空答案必须是非空字符串数组`)
    continue
  }

  expect(Array.isArray(question.options) && question.options.length >= 2 && question.options.every(isText), `题目 ${question.id} 的选项不完整`)
  const answer = question.answer
  expect(Array.isArray(answer) && answer.length >= 1, `题目 ${question.id} 的答案必须是非空下标数组`)
  if (Array.isArray(answer)) {
    expect(answer.every(index => Number.isInteger(index) && index >= 0 && index < question.options.length), `题目 ${question.id} 的答案下标越界；首个选项下标为 0`)
    expect(new Set(answer).size === answer.length, `题目 ${question.id} 的答案下标存在重复`)
    if (type === 'multi') expect(answer.length >= 2, `题目 ${question.id} 为多选题，答案应至少包含两个下标`)
    else expect(answer.length === 1, `题目 ${question.id} 为单选/判断题，答案应为单元素数组`)
  }
}

// 本地媒体按 uni-app 约定放在 src/static 下，页面中以 /static/media/... 引用，构建时会被复制到发布目录。
const staticRoot = path.resolve(projectRoot, 'src', 'static')

for (const resource of resources) {
  checkReferences(resource, '资源')
  expect(isText(resource.title), `资源 ${resource.id} 缺少标题`)
  expect(['video', 'slides', 'external', 'pdf'].includes(resource.type), `资源 ${resource.id} 的类型无效`)
  if (resource.type === 'pdf') {
    expect(isText(resource.src) && resource.src.startsWith('/static/courseware/') && resource.src.endsWith('.pdf'), `PDF ${resource.id} 的路径应为 /static/courseware/*.pdf`)
    if (isText(resource.src)) {
      const pdfPath = path.resolve(staticRoot, resource.src.replace(/^\/static\//, ''))
      const relative = path.relative(staticRoot, pdfPath)
      const inside = relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
      expect(inside, `PDF ${resource.id} 的路径超出 src/static`)
      if (inside) {
        try {
          const bytes = await readFile(pdfPath)
          expect(bytes.subarray(0, 5).toString('ascii') === '%PDF-', `PDF ${resource.id} 文件头无效`)
        } catch { errors.push(`PDF ${resource.id} 文件不存在或不可读取`) }
      }
    }
  }
  if (resource.type === 'slides') {
    expect(Array.isArray(resource.slides) && resource.slides.length > 0, `课件 ${resource.id} 缺少页面`)
    for (const [index, slide] of (resource.slides ?? []).entries()) {
      expect(isText(slide.title) && Array.isArray(slide.body) && slide.body.length > 0 && slide.body.every(isText), `课件 ${resource.id} 第 ${index + 1} 页缺少标题或正文`)
    }
  }
  if (resource.type === 'video') {
    expect(isText(resource.src), `视频 ${resource.id} 缺少 src`)
    if (!isText(resource.src) || /^https?:\/\//i.test(resource.src)) continue
    expect(resource.src.startsWith('/static/'), `本地视频 ${resource.id} 的路径应以 /static/ 开头`)
    const mediaPath = path.resolve(staticRoot, resource.src.replace(/^\/static\//i, ''))
    const relative = path.relative(staticRoot, mediaPath)
    const insideStatic = relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
    expect(insideStatic, `视频 ${resource.id} 的路径超出 src/static 目录`)
    if (!insideStatic) continue
    try {
      await access(mediaPath)
      if (path.extname(mediaPath).toLowerCase() === '.mp4') {
        const bytes = await readFile(mediaPath)
        expect(bytes.length > 32 && bytes.subarray(4, 8).toString('ascii') === 'ftyp', `视频 ${resource.id} 缺少有效 MP4 文件头`)
      }
    } catch {
      errors.push(`视频 ${resource.id} 的本地文件不存在或不可读取：${resource.src}`)
    }
  }
  if (resource.type === 'external') {
    if (!isText(resource.url)) {
      warnings.push(`网课资源 ${resource.id} 尚未填写 url，页面会显示「链接待补充」且入口不可点击`)
    } else {
      expect(/^https?:\/\/[^\s]+$/i.test(resource.url.trim()), `网课资源 ${resource.id} 的 url 不是有效的 http/https 地址：${resource.url}`)
    }
    if (!isText(resource.source) && !isText(resource.course)) warnings.push(`网课资源 ${resource.id} 未填写来源平台或课程名称，卡片上会显示「来源平台待补充」`)
  }
}

// Public directory snapshot is review evidence only; course.ts remains the runtime source.
const directory = JSON.parse(await readFile(path.join(projectRoot, 'docs', 'bilibili-directory.json'), 'utf8'))
const confirmed = directory.pages.filter(item => item.status === 'confirmed')
const episodes = resources.filter(item => item.id.startsWith(`bilibili-${directory.bvid}-p`))
expect(episodes.length === confirmed.length, '已接入网课数量与核对清单不一致')
for (const item of directory.pages) {
  const episode = episodes.find(r => r.id === `bilibili-${directory.bvid}-p${item.page}`)
  if (item.status === 'pending') { expect(!episode, `待核对 P${item.page} 不应接入`); continue }
  expect(Boolean(episode), `已核对 P${item.page} 未登记`)
  if (!episode) continue
  expect(episode.url === `https://www.bilibili.com/video/${directory.bvid}/?p=${item.page}`, `P${item.page} 链接与目录不一致`)
  expect(episode.chapterId === item.chapterId && JSON.stringify(episode.nodeIds) === JSON.stringify(item.nodeIds), `P${item.page} 关联与清单不一致`)
  expect(episode.title === `P${item.page} · ${item.part.replace(/^\[[^\]]+\]--/, '')}`, `P${item.page} 标题与目录不一致`)
}
for (const chapter of chapters) {
  expect(resources.filter(r => r.type === 'pdf' && r.chapterId === chapter.id).length === 1, `${chapter.id} 应有一份 PDF`)
}

if (errors.length) {
  console.error(`内容检查发现 ${errors.length} 个问题：`)
  for (const message of errors) console.error(`- ${message}`)
  process.exitCode = 1
} else {
  console.log(`内容检查通过：${chapters.length} 章、${nodes.length} 个知识点、${relations.length} 条关系、${resources.length} 个资源、${questions.length} 道题。`)
  console.log('ID、关联引用、题目答案下标、课件结构、本地媒体与 PDF 文件、网课分集链接及核对清单均有效。')
  console.log('本检查不替代课程内容复核或浏览器中的播放与交互验证。')
}
if (warnings.length) {
  console.log(`另有 ${warnings.length} 条提示（不影响退出码）：`)
  for (const message of warnings) console.log(`- ${message}`)
}
