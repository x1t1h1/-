<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppShell from '../../components/AppShell.vue'
import Icon from '../../components/Icon.vue'
import { chapters, nodes, questions } from '../../data/course'
import type { KnowledgeNode, Question } from '../../data/course'
import { navigate, progress, stats, submitAnswer, toast } from '../../store'

type Scope = 'all' | 'todo' | 'wrong'

const scope = ref<Scope>('all')
const chapterFilter = ref('')
const nodeFilter = ref('')
const search = ref('')
const currentIndex = ref(0)
const picked = reactive<Record<string, number[]>>({})
const fillInputs = reactive<Record<string, string[]>>({})
const revealed = reactive<Record<string, boolean>>({})
const results = reactive<Record<string, boolean>>({})
const snapshot = ref<string[] | null>(null)
const letters = ['A', 'B', 'C', 'D', 'E', 'F']
const blank: Question = { id: '', nodeIds: [], chapterId: '', stem: '', options: [], answer: [], explanation: '', difficulty: '基础' }

const attemptedIds = computed(() => new Set(progress.attempts.map(item => item.questionId)))
const pool = computed(() => questions.filter(item => {
  if (nodeFilter.value && !item.nodeIds.includes(nodeFilter.value)) return false
  if (chapterFilter.value && item.chapterId !== chapterFilter.value) return false
  if (scope.value !== 'all' && !snapshot.value?.includes(item.id)) return false
  const keyword = search.value.trim()
  if (keyword && !item.stem.includes(keyword)) return false
  return true
}))
const current = computed<Question>(() => pool.value[currentIndex.value] || blank)
const hasCurrent = computed(() => Boolean(current.value.id))
const questionType = computed<'single' | 'multi' | 'judge' | 'fill'>(() => current.value.type ?? 'single')
const answerIndexes = computed(() => current.value.answer ?? [])
const pickedIndexes = computed(() => picked[current.value.id] ?? [])
const hasPick = computed(() => pickedIndexes.value.length > 0)
const answerLabel = computed(() => answerIndexes.value.map(i => letters[i]).join('、') || '—')
const answerText = computed(() => answerIndexes.value.map(i => current.value.options?.[i]).join('、') || '—')
const pickedLabel = computed(() => pickedIndexes.value.map(i => letters[i]).join('、') || '—')
const pickedText = computed(() => pickedIndexes.value.map(i => current.value.options?.[i]).join('、') || '—')
const fillAnswerText = computed(() => (current.value.answers ?? []).join('；'))
const fillPickedText = computed(() => (fillInputs[current.value.id] ?? []).map(value => String(value ?? '').trim()).join('；') || '—')
const hasFillInput = computed(() => (fillInputs[current.value.id] ?? []).some(value => String(value ?? '').trim() !== ''))
const fillReady = computed(() => {
  const answers = current.value.answers ?? []
  if (!answers.length) return false
  const inputs = fillInputs[current.value.id] ?? []
  return answers.every((_, index) => String(inputs[index] ?? '').trim() !== '')
})
function isPicked(item: Question, index: number) { return (picked[item.id] ?? []).includes(index) }
const currentChapter = computed(() => chapters.find(item => item.id === current.value.chapterId))
const relatedNodes = computed(() => current.value.nodeIds
  .map(id => nodes.find(node => node.id === id))
  .filter((node): node is KnowledgeNode => Boolean(node)))
const nodeName = computed(() => nodes.find(node => node.id === nodeFilter.value)?.title || '')
const scopeHint = computed(() => scope.value === 'wrong'
  ? '分组在切换时固定：已重做正确的题目仍会保留，直到你刷新分组或重新进入本页。'
  : scope.value === 'todo'
    ? '分组在切换时固定：刚作答的题目会保留在这里，直到你刷新分组。'
    : '')
const accuracyLabel = computed(() => stats.value.attempts ? stats.value.accuracy + '%' : '—')

function pad(value: number) { return value < 10 ? '0' + value : String(value) }
function snapshotFor(value: Scope) {
  if (value === 'todo') return questions.filter(item => !attemptedIds.value.has(item.id)).map(item => item.id)
  if (value === 'wrong') return [...progress.wrong]
  return null
}
function refreshGroup() { snapshot.value = snapshotFor(scope.value); currentIndex.value = 0 }

watch(scope, value => { snapshot.value = snapshotFor(value); currentIndex.value = 0 })
watch(pool, list => { currentIndex.value = list.length ? Math.min(currentIndex.value, list.length - 1) : 0 })

onLoad(options => {
  const target = options?.question
  if (target && questions.some(item => item.id === target)) {
    scope.value = 'all'
    chapterFilter.value = ''
    nodeFilter.value = ''
    search.value = ''
    snapshot.value = null
    currentIndex.value = Math.max(questions.findIndex(item => item.id === target), 0)
    return
  }
  if (options?.node && nodes.some(node => node.id === options.node)) nodeFilter.value = options.node
  if (options?.chapter && chapters.some(item => item.id === options.chapter)) chapterFilter.value = options.chapter
  if (options?.q) search.value = options.q
})

function choose(index: number) {
  if (!hasCurrent.value || revealed[current.value.id]) return
  const cur = picked[current.value.id] ?? []
  if ((current.value.type ?? 'single') === 'multi') {
    const next = cur.includes(index) ? cur.filter(i => i !== index) : [...cur, index].sort((a, b) => a - b)
    picked[current.value.id] = next
  } else {
    picked[current.value.id] = [index]
  }
}
function onFillInput(index: number, event: Event) {
  const item = current.value
  if (!item.id || revealed[item.id]) return
  const detail = (event as unknown as { detail?: { value?: string } }).detail
  const target = event.target as HTMLInputElement | null
  const value = detail?.value ?? target?.value ?? ''
  const currentInputs = fillInputs[item.id] ?? Array((item.answers ?? []).length).fill('')
  const next = currentInputs.slice()
  next[index] = value
  fillInputs[item.id] = next
}
function submit() {
  const item = current.value
  if (!item.id) return
  if ((item.type ?? 'single') === 'fill') {
    const inputs = fillInputs[item.id] ?? []
    if (!inputs.length || inputs.some(value => !String(value ?? '').trim())) { toast('请填写所有空'); return }
    const correct = submitAnswer(item.id, inputs)
    results[item.id] = correct
    revealed[item.id] = true
    toast(correct ? '回答正确，继续保持' : '已记入错题，稍后可重做')
    return
  }
  const choice = picked[item.id] ?? []
  if (!choice.length) { toast((item.type ?? 'single') === 'multi' ? '请至少选择一个选项' : '请先选择一个选项'); return }
  const correct = submitAnswer(item.id, choice)
  results[item.id] = correct
  revealed[item.id] = true
  toast(correct ? '回答正确，继续保持' : '已记入错题，稍后可重做')
}
function redo() {
  const item = current.value
  if (!item.id) return
  delete picked[item.id]
  delete fillInputs[item.id]
  delete revealed[item.id]
  delete results[item.id]
}
function go(index: number) { currentIndex.value = index }
function step(offset: number) {
  const target = currentIndex.value + offset
  if (target >= 0 && target < pool.value.length) currentIndex.value = target
}
function clearFilters() { scope.value = 'all'; chapterFilter.value = ''; nodeFilter.value = ''; search.value = '' }
</script>

<template>
  <AppShell active="practice" title="习题练习">
    <div class="page-heading">
      <div><h1>让理解，经得起检验</h1><p>从知识图谱走到这里，用一道小题确认自己真的懂了。</p></div>
      <span class="tag"><Icon name="edit" :size="13" />{{ questions.length }} 道演示习题 · 待重做 {{ progress.wrong.length }} 道</span>
    </div>

    <section class="practice-summary">
      <div>
        <span class="eyebrow">LEARN BY DOING</span>
        <h2>每一次作答，都会留下清晰的反馈。</h2>
        <p>选择答案提交后立即判分，并给出正确答案、解析与关联知识点。</p>
      </div>
      <div class="practice-summary-stats">
        <span><strong>{{ stats.attempts }}</strong>累计作答</span>
        <i></i>
        <span><strong>{{ accuracyLabel }}</strong>正确率</span>
        <i></i>
        <span><strong>{{ progress.wrong.length }}</strong>待重做错题</span>
      </div>
    </section>

    <div class="practice-toolbar">
      <div class="tabs" role="tablist" aria-label="练习分组">
        <button role="tab" :aria-selected="scope === 'all'" :class="{ active: scope === 'all' }" @click="scope = 'all'">全部题目</button>
        <button role="tab" :aria-selected="scope === 'todo'" :class="{ active: scope === 'todo' }" @click="scope = 'todo'">未作答</button>
        <button role="tab" :aria-selected="scope === 'wrong'" :class="{ active: scope === 'wrong' }" @click="scope = 'wrong'">错题重做</button>
      </div>
      <div class="filter-bar">
        <select v-model="chapterFilter" class="filter-select" aria-label="按章节筛选习题">
          <option value="">全部章节</option>
          <option v-for="item in chapters" :key="item.id" :value="item.id">{{ item.number }} · {{ item.shortTitle }}</option>
        </select>
        <div class="local-search">
          <Icon name="search" :size="15" />
          <input v-model="search" placeholder="搜索题干关键词" aria-label="搜索题干" />
        </div>
      </div>
    </div>

    <div v-if="nodeFilter || scopeHint" class="practice-filter-line">
      <span v-if="nodeFilter" class="active-filter">知识点：{{ nodeName }}<button aria-label="清除知识点筛选" @click="nodeFilter = ''"><Icon name="close" :size="13" /></button></span>
      <span v-if="scopeHint" class="group-hint"><Icon name="bulb" :size="13" />{{ scopeHint }}</span>
    </div>

    <div class="practice-layout">
      <div class="practice-main">
        <article v-if="hasCurrent" class="panel question-card">
          <div class="question-meta">
            <span class="question-position-text">第 {{ currentIndex + 1 }} / {{ pool.length }} 题</span>
            <span class="tag">{{ currentChapter?.shortTitle }}</span>
            <span class="tag" :class="{ amber: current.difficulty === '进阶' }">{{ current.difficulty }}</span>
            <span v-if="attemptedIds.has(current.id)" class="tag blue">已作答过</span>
          </div>
          <h2 class="question-stem">{{ current.stem }}</h2>
          <div v-if="questionType === 'fill'" class="fill-inputs">
            <label v-for="(blank, index) in current.answers" :key="index" class="fill-field">
              <span class="fill-label">空 {{ index + 1 }}</span>
              <input
                type="text"
                :value="fillInputs[current.id]?.[index] ?? ''"
                :disabled="revealed[current.id]"
                :aria-label="`第 ${index + 1} 空`"
                placeholder="请输入答案"
                @input="onFillInput(index, $event)"
              />
            </label>
          </div>

          <div v-else class="options" :class="{ 'options-judge': questionType === 'judge' }">
            <button
              v-for="(option, index) in current.options"
              :key="index"
              class="option"
              :class="{
                'option-multi': questionType === 'multi',
                selected: isPicked(current, index) && !revealed[current.id],
                correct: revealed[current.id] && (current.answer ?? []).includes(index),
                wrong: revealed[current.id] && isPicked(current, index) && !(current.answer ?? []).includes(index),
              }"
              :disabled="revealed[current.id]"
              @click="choose(index)"
            >
              <span v-if="questionType === 'multi'" class="option-checkbox" :class="{ checked: isPicked(current, index) }"><Icon v-if="isPicked(current, index)" name="check" :size="11" /></span>
              <span v-else-if="questionType === 'judge'" class="option-judge" :class="{ 'is-true': index === 0, 'is-false': index === 1 }"><Icon :name="index === 0 ? 'check' : 'close'" :size="12" /></span>
              <span v-else class="option-letter">{{ letters[index] }}</span>
              <span>{{ option }}</span>
            </button>
          </div>

          <div v-if="revealed[current.id]" class="result-box" :class="{ 'is-wrong': !results[current.id] }">
            <div class="result-head">
              <Icon :name="results[current.id] ? 'check' : 'close'" :size="15" />
              <span>{{ results[current.id] ? '回答正确，这个知识点已经通过检验。' : '回答错误，看完解析再重做一次。' }}</span>
            </div>
            <p v-if="questionType === 'fill'" class="result-answer">正确答案：<b>{{ fillAnswerText }}</b></p>
            <p v-else class="result-answer">正确答案：<b>{{ answerLabel }}</b> · {{ answerText }}</p>
            <p v-if="questionType === 'fill'" class="result-pick">你的作答：{{ fillPickedText }}</p>
            <p v-else class="result-pick">你的选择：{{ pickedLabel }} · {{ pickedText }}</p>
            <div class="explanation"><span class="explanation-label">解析</span><p>{{ current.explanation }}</p></div>
          </div>

          <div class="question-nodes">
            <span class="question-nodes-label">关联知识点</span>
            <button v-for="item in relatedNodes" :key="item.id" class="chip" @click="navigate('graph', { node: item.id })">{{ item.title }}<Icon name="arrow" :size="11" /></button>
          </div>

          <div class="question-actions">
            <template v-if="!revealed[current.id]">
              <button class="button primary" :disabled="questionType === 'fill' && !fillReady" @click="submit"><Icon name="check" :size="16" />提交答案</button>
              <button v-if="hasPick || hasFillInput" class="button ghost" @click="redo">清除选择</button>
            </template>
            <template v-else>
              <button class="button secondary" @click="redo"><Icon name="reset" :size="16" />重新作答</button>
            </template>
            <span class="question-step">
              <button class="button small" :disabled="currentIndex === 0" @click="step(-1)">上一题</button>
              <button class="button small" :disabled="currentIndex >= pool.length - 1" @click="step(1)">下一题</button>
            </span>
          </div>
        </article>

        <div v-else class="empty-state panel">
          <span class="empty-icon"><Icon name="edit" :size="27" /></span>
          <h3>{{ scope === 'wrong' ? '当前没有需要重做的错题' : '这个分组里暂时没有题目' }}</h3>
          <p>{{ scope === 'wrong' ? '练习中答错的题目会自动进入错题本；全部重做正确后，这里就会清空。' : '可以调整章节、关键词，或切换到其他分组继续练习。' }}</p>
          <button class="button secondary" @click="clearFilters">查看全部题目</button>
        </div>
      </div>

      <aside class="practice-aside">
        <section class="panel aside-panel">
          <div class="section-title"><h2>练习概览</h2><span>{{ questions.length }} 题</span></div>
          <div class="overview-rows">
            <div><span>累计作答</span><strong>{{ stats.attempts }} 次</strong></div>
            <div><span>已作答题目</span><strong>{{ attemptedIds.size }} / {{ questions.length }}</strong></div>
            <div><span>正确率</span><strong>{{ accuracyLabel }}</strong></div>
            <div><span>待重做错题</span><strong>{{ progress.wrong.length }} 道</strong></div>
          </div>
          <span class="progress-track overview-track"><span :style="{ width: (attemptedIds.size / questions.length * 100) + '%' }"></span></span>
          <p class="aside-note">正确率按每一次作答统计；重做同一道题会追加一条练习记录。</p>
        </section>

        <section class="panel aside-panel">
          <div class="section-title">
            <h2>题目导航</h2>
            <button class="text-link" @click="refreshGroup">刷新分组 <Icon name="reset" :size="13" /></button>
          </div>
          <div v-if="pool.length" class="question-nav">
            <button
              v-for="(item, index) in pool"
              :key="item.id"
              class="nav-row"
              :class="{ active: index === currentIndex, 'is-wrong': progress.wrong.includes(item.id) }"
              @click="go(index)"
            >
              <span class="nav-index">{{ pad(index + 1) }}</span>
              <span class="nav-stem">{{ item.stem }}</span>
              <Icon v-if="progress.wrong.includes(item.id)" name="close" :size="12" />
              <Icon v-else-if="attemptedIds.has(item.id)" name="check" :size="12" />
            </button>
          </div>
          <p v-else class="aside-note">当前分组没有题目。</p>
        </section>
      </aside>
    </div>
  </AppShell>
</template>

<style scoped>
.practice-summary{border:1px solid #dee9dc;border-radius:11px;background:#edf3e9;padding:25px 30px;display:flex;align-items:center;justify-content:space-between;gap:22px;margin-bottom:24px}
.practice-summary .eyebrow{font-size:8px;color:#9eae91}
.practice-summary h2{font-size:23px;font-weight:500;color:#4b6746;margin-top:10px}
.practice-summary p{font-size:11px;color:#8d9e7e;margin-top:10px}
.practice-summary-stats{display:flex;align-items:center;gap:26px;color:#849a76;flex-shrink:0}
.practice-summary-stats>span{font-size:9px;display:flex;flex-direction:column;gap:5px;text-align:center}
.practice-summary-stats strong{font-family:Georgia,serif;font-size:29px;font-weight:400;letter-spacing:1px}
.practice-summary-stats>i{height:34px;width:1px;background:#d8e3d0}
.practice-toolbar{display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap}
.practice-filter-line{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:14px}
.active-filter{display:inline-flex;align-items:center;gap:9px;background:#edf5e9;color:#7f9b70;padding:7px 10px;border-radius:5px;font-size:10px}
.active-filter button{display:flex}
.group-hint{display:flex;align-items:center;gap:6px;font-size:10px;color:#98a68f;line-height:1.7}
.practice-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:21px;align-items:start;margin-top:22px}
.practice-main{min-width:0}
.question-card{padding:26px 27px}
.question-meta{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.question-position-text{font-size:10px;letter-spacing:1px;color:#9aa79c}
.question-stem{font-size:15px;line-height:2;font-weight:600;color:#2c4239;margin:16px 0 20px}
.options{display:flex;flex-direction:column;gap:10px}
.option{display:flex;gap:12px;align-items:flex-start;text-align:left;padding:14px 15px;border:1px solid #e5ebe8;border-radius:8px;background:#fff;font-size:12px;line-height:1.85;color:#4c5f56;transition:border-color .18s,background .18s}
.option:hover:not(:disabled){border-color:#bcd4c0;background:#f7fbf6}
.option:disabled{opacity:1;cursor:default}
.option-letter{width:22px;height:22px;border-radius:50%;background:#f1f5f0;color:#8b9a8c;font-size:10px;font-weight:600;display:grid;place-items:center;flex-shrink:0}
.option.selected{border-color:#8fbb9b;background:#f2f9f1}
.option.selected .option-letter{background:#3c7d5c;color:#fff}
.option.correct{border-color:#8fbb9b;background:#eef8ec}
.option.correct .option-letter{background:#4c8f62;color:#fff}
.option.wrong{border-color:#e2c3b8;background:#fdf4f0}
.option.wrong .option-letter{background:#b96e58;color:#fff}
.option-multi{align-items:center}
.option-checkbox{width:20px;height:20px;border-radius:5px;border:1.5px solid #c9d6c9;background:#f6faf5;color:#fff;display:grid;place-items:center;flex-shrink:0;transition:border-color .18s,background .18s}
.option-checkbox.checked{background:#3c7d5c;border-color:#3c7d5c}
.option.correct .option-checkbox.checked{background:#4c8f62;border-color:#4c8f62}
.option.wrong .option-checkbox.checked{background:#b96e58;border-color:#b96e58}
.options-judge{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.options-judge .option{justify-content:center;gap:9px;align-items:center}
.option-judge{width:22px;height:22px;border-radius:50%;background:#f1f5f0;color:#8b9a8c;display:grid;place-items:center;flex-shrink:0}
.option-judge.is-true{color:#3f8a52}
.option-judge.is-false{color:#b96e58}
.option.selected .option-judge{background:#3c7d5c;color:#fff}
.option.correct .option-judge{background:#4c8f62;color:#fff}
.option.wrong .option-judge{background:#b96e58;color:#fff}
.fill-inputs{display:flex;flex-direction:column;gap:11px}
.fill-field{display:flex;align-items:center;gap:12px}
.fill-label{width:34px;flex-shrink:0;font-size:11px;color:#8b9a8c;font-weight:600}
.fill-field input{flex:1;min-width:0;min-height:40px;border:1px solid #e5ebe8;border-radius:8px;background:#fff;color:#4c5f56;font-size:12.5px;padding:9px 12px;transition:border-color .18s,background .18s}
.fill-field input:focus{border-color:#8fbb9b;outline:none;background:#f7fbf6}
.fill-field input:disabled{background:#f2f6f1;color:#7c8b7e;cursor:default}
.result-box{margin-top:20px;padding:17px 18px;border:1px solid #dbe9db;border-radius:9px;background:#f4faf3}
.result-box.is-wrong{border-color:#eeddd5;background:#fdf6f2}
.result-head{display:flex;align-items:center;gap:9px;font-size:12px;font-weight:600;color:#3f7a55}
.result-box.is-wrong .result-head{color:#a5604c}
.result-answer{font-size:11.5px;color:#7d8f80;margin-top:11px;line-height:1.9}
.result-answer b{color:#3f7a55;font-weight:600}
.result-box.is-wrong .result-answer b{color:#a5604c}
.result-pick{font-size:11px;color:#9aa79b;margin-top:6px;line-height:1.9}
.explanation{margin-top:13px;padding-top:13px;border-top:1px dashed #e2ece0}
.explanation-label{font-size:10px;letter-spacing:1px;color:#93a68f}
.explanation p{font-size:11.5px;line-height:2;color:#7c8b7e;margin-top:7px}
.question-nodes{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:19px}
.question-nodes-label{font-size:10px;color:#a3ae9c;margin-right:2px}
.question-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:22px}
.question-step{display:flex;gap:8px;margin-left:auto}
.practice-aside{display:flex;flex-direction:column;gap:18px}
.aside-panel{padding:20px 19px}
.aside-panel .section-title{margin-bottom:12px}
.aside-panel h2{font-size:14px}
.aside-panel .section-title>span{font-size:9px;color:#a7b29f}
.overview-rows{display:flex;flex-direction:column;gap:11px;font-size:11px;color:#87968a}
.overview-rows>div{display:flex;justify-content:space-between;align-items:center;gap:10px}
.overview-rows strong{font-weight:600;color:#4d6a55}
.overview-track{display:block;height:5px;margin-top:16px}
.aside-note{font-size:10px;line-height:1.85;color:#9aa79b;margin-top:13px}
.question-nav{display:flex;flex-direction:column;gap:6px;max-height:360px;overflow:auto}
.nav-row{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:7px;background:#f7f9f6;font-size:10.5px;color:#77887a;text-align:left;width:100%}
.nav-row:hover{background:#eff5ee}
.nav-row.active{background:#eaf3ed;color:#2f6b4f;font-weight:600}
.nav-index{font-family:Georgia,serif;font-size:10px;color:#a3af9f}
.nav-stem{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav-row>svg{color:#b7c3b4;margin-left:auto}
.nav-row.is-wrong>svg{color:#c08a75}
@media(max-width:1200px){.practice-layout{grid-template-columns:minmax(0,1fr) 265px;gap:15px}.question-card{padding:22px 20px}.practice-summary-stats{gap:18px}}
@media(max-width:1000px){.practice-layout{grid-template-columns:1fr}.question-nav{max-height:240px}.practice-summary{flex-direction:column;align-items:flex-start;gap:16px}}
@media(max-width:760px){.practice-summary{padding:21px 19px}.practice-summary h2{font-size:19px;line-height:1.5}.practice-summary-stats{gap:16px}.practice-summary-stats strong{font-size:24px}.question-card{padding:20px 17px}.question-stem{font-size:13.5px}.option{font-size:11.5px;padding:12px}.question-step{margin-left:0;width:100%}.group-hint{font-size:9px}.page-heading>.tag{display:none}}
</style>
