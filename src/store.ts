import { reactive, computed } from 'vue'
import { nodes, resources, questions } from './data/course'

export interface Attempt { questionId: string; selected: number[] | string[]; correct: boolean; at: string }
interface Progress { completed: string[]; bookmarks: string[]; attempts: Attempt[]; wrong: string[]; lastResource: string; lastNode: string; visits: string[] }
const key = 'thermolearn.progress.v1'
const empty = (): Progress => ({ completed: [], bookmarks: [], attempts: [], wrong: [], lastResource: '', lastNode: 'first-law', visits: [] })
function restore(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null')
    if (!raw || !Array.isArray(raw.completed) || !Array.isArray(raw.attempts)) return empty()
    return { ...empty(), ...raw, bookmarks: Array.isArray(raw.bookmarks) ? raw.bookmarks : [], wrong: Array.isArray(raw.wrong) ? raw.wrong : [], visits: Array.isArray(raw.visits) ? raw.visits : [] }
  } catch { return empty() }
}
export const progress = reactive<Progress>(restore())
export const feedback = reactive({ message: '', visible: false })
let feedbackTimer: ReturnType<typeof setTimeout>
export function toast(message: string) { feedback.message = message; feedback.visible = true; clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => feedback.visible = false, 2600) }
function persist() { try { localStorage.setItem(key, JSON.stringify(progress)) } catch { toast('浏览器存储不可用，本次记录仅在当前会话保留') } }
export function navigate(page: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString()
  uni.reLaunch({ url: '/pages/' + page + '/index' + (query ? '?' + query : '') })
}
export function visitNode(id: string) { progress.lastNode = id; if (!progress.visits.includes(id)) progress.visits.push(id); persist() }
export function openResource(id: string) { progress.lastResource = id; persist(); navigate('resources', { resource: id }) }
export function completeResource(id: string) {
  if (!progress.completed.includes(id)) { progress.completed.push(id); persist(); toast('已记录学习完成，个人中心已同步更新') }
}
export function toggleBookmark(id: string) {
  const index = progress.bookmarks.indexOf(id)
  if (index >= 0) progress.bookmarks.splice(index, 1); else progress.bookmarks.push(id)
  persist(); toast(index >= 0 ? '已取消收藏' : '已收藏，可在个人中心查看')
}
function normalizeFill(value: string): string {
  return String(value)
    .trim()
    .replace(/　/g, ' ')
    .replace(/[！-～]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .toLowerCase()
}
export function submitAnswer(questionId: string, selected: number[] | string[]) {
  const q = questions.find(item => item.id === questionId)
  if (!q) return false
  const type = q.type ?? 'single'
  let correct = false
  if (type === 'fill') {
    const inputs = (selected as string[]).map(String)
    const expected = q.answers ?? []
    correct = expected.length === inputs.length && expected.every((answer, index) => normalizeFill(answer) === normalizeFill(inputs[index]))
  } else {
    const answer = q.answer ?? []
    const picked = selected as number[]
    correct = type === 'multi'
      ? answer.length === picked.length && answer.every(index => picked.includes(index))
      : picked.length === 1 && picked[0] === answer[0]
  }
  progress.attempts.push({ questionId, selected, correct, at: new Date().toISOString() })
  if (!correct && !progress.wrong.includes(questionId)) progress.wrong.push(questionId)
  if (correct) progress.wrong = progress.wrong.filter(id => id !== questionId)
  persist(); return correct
}
export const learnedNodeIds = computed(() => [...new Set(resources.filter(r => progress.completed.includes(r.id)).flatMap(r => r.nodeIds))])
export const stats = computed(() => ({ learned: learnedNodeIds.value.length, completed: progress.completed.length, totalResources: resources.length, attempts: progress.attempts.length, accuracy: progress.attempts.length ? Math.round(progress.attempts.filter(a => a.correct).length / progress.attempts.length * 100) : 0, progress: Math.round(learnedNodeIds.value.length / nodes.length * 100) }))
export function resetProgress() { Object.assign(progress, empty()); persist(); toast('演示记录已重置') }
export function exportProgress() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...progress }, null, 2)], { type: 'application/json' })
  const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = '热知-学习记录.json'; a.click(); setTimeout(() => URL.revokeObjectURL(href), 500)
}
export function dateLabel(date: string) { return new Date(date).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
