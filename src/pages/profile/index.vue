<script setup lang="ts">
import { ref, computed } from 'vue'
import AppShell from '../../components/AppShell.vue'
import Icon from '../../components/Icon.vue'
import { chapters, nodes, questions, resources, resourceTypeIcon, resourceTypeLabel } from '../../data/course'
import type { KnowledgeNode, Question } from '../../data/course'
import { dateLabel, exportProgress, learnedNodeIds, navigate, openResource, progress, resetProgress, stats } from '../../store'

const resetOpen = ref(false)
const letters = 'ABCDEF'

const wrongQuestions = computed(() => progress.wrong
  .map(id => questions.find(item => item.id === id))
  .filter((item): item is Question => Boolean(item)))
const bookmarks = computed(() => resources.filter(item => progress.bookmarks.includes(item.id)))
const recentAttempts = computed(() => progress.attempts.slice(-8).reverse())
const visitedNodes = computed(() => progress.visits.slice(-6).reverse()
  .map(id => nodes.find(item => item.id === id))
  .filter((item): item is KnowledgeNode => Boolean(item)))
const lastResource = computed(() => resources.find(item => item.id === progress.lastResource))
const chapterRows = computed(() => chapters.map(chapter => {
  const list = nodes.filter(node => node.chapterId === chapter.id)
  const done = list.filter(node => learnedNodeIds.value.includes(node.id)).length
  return { id: chapter.id, number: chapter.number, title: chapter.shortTitle, done, total: list.length, percent: list.length ? Math.round(done / list.length * 100) : 0 }
}))
const resourcePercent = computed(() => resources.length ? Math.round(progress.completed.length / resources.length * 100) : 0)
const nodePercent = computed(() => nodes.length ? Math.round(learnedNodeIds.value.length / nodes.length * 100) : 0)
const accuracyLabel = computed(() => stats.value.attempts ? stats.value.accuracy + '%' : '—')
const touchedChapters = computed(() => chapterRows.value.filter(row => row.done > 0).length)
const hasRecords = computed(() => stats.value.attempts > 0 || progress.completed.length > 0 || progress.bookmarks.length > 0 || progress.wrong.length > 0 || progress.visits.length > 0)

function stemOf(id: string) { return questions.find(item => item.id === id)?.stem || '（题目内容已更新）' }
function nodeTitle(id?: string) {
  if (!id) return '综合练习'
  return nodes.find(item => item.id === id)?.title || id
}
function isFillQuestion(id: string) { return (questions.find(item => item.id === id)?.type ?? 'single') === 'fill' }
function answerLabelOf(item: { questionId: string; selected: number[] | string[] }) {
  const list = Array.isArray(item.selected) ? item.selected : [item.selected]
  if (isFillQuestion(item.questionId)) return list.map(value => String(value).trim() || '—').join('；')
  return list.map(value => letters[Number(value)] ?? '—').join('、') || '—'
}
function confirmReset() { resetOpen.value = false; resetProgress() }
</script>

<template>
  <AppShell active="profile" title="个人中心">
    <div class="page-heading">
      <div><h1>把每一次探索，留成记录</h1><p>学习完成、练习结果与收藏都保存在当前浏览器中，可随时回顾或导出。</p></div>
      <span class="tag"><Icon name="clock" :size="13" />本地学习空间 · 累计 {{ stats.attempts }} 次作答</span>
    </div>

    <div class="profile-stats">
      <article class="panel profile-stat">
        <span class="stat-icon"><Icon name="graph" :size="21" /></span>
        <div class="profile-stat-body">
          <span class="profile-stat-label">已学知识点</span>
          <div class="count-number">{{ learnedNodeIds.length }}<small>/ {{ nodes.length }}</small></div>
          <span class="progress-track stat-track"><span :style="{ width: nodePercent + '%' }"></span></span>
        </div>
      </article>
      <article class="panel profile-stat">
        <span class="stat-icon blue"><Icon name="video" :size="21" /></span>
        <div class="profile-stat-body">
          <span class="profile-stat-label">资源学习进度</span>
          <div class="count-number">{{ progress.completed.length }}<small>/ {{ resources.length }}</small></div>
          <span class="progress-track stat-track"><span :style="{ width: resourcePercent + '%' }"></span></span>
        </div>
      </article>
      <article class="panel profile-stat">
        <span class="stat-icon orange"><Icon name="edit" :size="21" /></span>
        <div class="profile-stat-body">
          <span class="profile-stat-label">累计练习次数</span>
          <div class="count-number">{{ stats.attempts }}<small>次</small></div>
          <span class="profile-stat-caption">{{ wrongQuestions.length }} 道错题待重做</span>
        </div>
      </article>
      <article class="panel profile-stat">
        <span class="stat-icon purple"><Icon name="target" :size="21" /></span>
        <div class="profile-stat-body">
          <span class="profile-stat-label">练习正确率</span>
          <div class="count-number">{{ accuracyLabel }}</div>
          <span class="profile-stat-caption">{{ stats.attempts ? '基于你的实际作答' : '完成首次练习后生成' }}</span>
        </div>
      </article>
    </div>

    <div class="profile-layout">
      <div class="profile-main">
        <section class="panel profile-panel">
          <div class="section-title"><h2>章节学习进度</h2><span>{{ touchedChapters }} / {{ chapterRows.length }} 章已有记录</span></div>
          <div class="chapter-list">
            <button v-for="row in chapterRows" :key="row.id" class="chapter-row" @click="navigate('graph', { chapter: row.id })">
              <span class="chapter-name">{{ row.number }} · {{ row.title }}</span>
              <span class="progress-track chapter-bar"><span :style="{ width: row.percent + '%' }"></span></span>
              <span class="chapter-value">{{ row.done }}/{{ row.total }}</span>
            </button>
          </div>
          <p class="panel-note">知识点在关联资源标记「已学」后计入进度，点击章节可回到知识图谱查看。</p>
        </section>

        <section class="panel profile-panel">
          <div class="section-title"><h2>资源学习进度</h2><span>{{ progress.completed.length }} / {{ resources.length }} 项已完成</span></div>
          <div class="record-list">
            <button v-for="item in resources" :key="item.id" class="record-row" @click="openResource(item.id)">
              <span class="record-mark" :class="progress.completed.includes(item.id) ? 'is-correct' : 'is-idle'"><Icon :name="progress.completed.includes(item.id) ? 'check' : resourceTypeIcon[item.type]" :size="13" /></span>
              <span class="record-body">
                <strong>{{ item.title }}</strong>
                <small>{{ resourceTypeLabel[item.type] }} · {{ item.duration }}<template v-if="progress.bookmarks.includes(item.id)"> · 已收藏</template></small>
              </span>
              <span class="record-state">{{ progress.completed.includes(item.id) ? '已学' : '未学' }}</span>
            </button>
          </div>
        </section>

        <section class="panel profile-panel">
          <div class="section-title"><h2>错题记录</h2><span>{{ wrongQuestions.length }} 道待重做</span></div>
          <div v-if="wrongQuestions.length" class="record-list">
            <div v-for="item in wrongQuestions" :key="item.id" class="record-row">
              <span class="record-mark is-wrong"><Icon name="close" :size="13" /></span>
              <span class="record-body">
                <strong>{{ item.stem }}</strong>
                <small>{{ nodeTitle(item.nodeIds[0]) }} · {{ item.difficulty }}</small>
              </span>
              <button class="button small" @click="navigate('practice', { question: item.id })">重做<Icon name="arrow" :size="13" /></button>
            </div>
          </div>
          <div v-else class="empty-state">
            <span class="empty-icon"><Icon name="check" :size="26" /></span>
            <h3>暂时没有错题</h3>
            <p>练习中答错的题目会自动收集到这里；重做正确后会自动移出。</p>
            <button class="button secondary" @click="navigate('practice')">去练习</button>
          </div>
        </section>

        <section class="panel profile-panel">
          <div class="section-title"><h2>练习记录</h2><span>最近 {{ recentAttempts.length }} 次</span></div>
          <div v-if="recentAttempts.length" class="record-list">
            <div v-for="(item, index) in recentAttempts" :key="index" class="record-row">
              <span class="record-mark" :class="item.correct ? 'is-correct' : 'is-wrong'"><Icon :name="item.correct ? 'check' : 'close'" :size="13" /></span>
              <span class="record-body">
                <strong>{{ stemOf(item.questionId) }}</strong>
                <small>{{ dateLabel(item.at) }} · 你的{{ isFillQuestion(item.questionId) ? '作答' : '选择' }} {{ answerLabelOf(item) }}</small>
              </span>
              <span class="record-state" :class="{ 'is-wrong-text': !item.correct }">{{ item.correct ? '正确' : '错误' }}</span>
            </div>
          </div>
          <div v-else class="empty-state">
            <span class="empty-icon"><Icon name="edit" :size="26" /></span>
            <h3>还没有练习记录</h3>
            <p>完成一次作答后，这里会按时间倒序列出每一次的判分结果。</p>
            <button class="button secondary" @click="navigate('practice')">开始练习</button>
          </div>
        </section>
      </div>

      <aside class="profile-aside">
        <section class="panel profile-panel">
          <div class="section-title"><h2>我的收藏</h2><span>{{ bookmarks.length }} 项</span></div>
          <div v-if="bookmarks.length" class="fav-list">
            <button v-for="item in bookmarks" :key="item.id" class="fav-row" @click="openResource(item.id)">
              <span class="fav-icon" :class="{ external: item.type === 'external' }"><Icon :name="resourceTypeIcon[item.type]" :size="15" /></span>
              <span class="fav-body"><strong>{{ item.title }}</strong><small>{{ resourceTypeLabel[item.type] }} · {{ item.duration }}</small></span>
              <Icon name="chevron" :size="13" />
            </button>
          </div>
          <p v-else class="panel-note">还没有收藏。在「视频与课件」页点击书签图标，即可把资源收到这里。</p>
        </section>

        <section class="panel profile-panel">
          <div class="section-title"><h2>最近浏览的知识点</h2><span>{{ visitedNodes.length }} 个</span></div>
          <div v-if="visitedNodes.length" class="chip-list">
            <button v-for="item in visitedNodes" :key="item.id" class="chip" @click="navigate('graph', { node: item.id })">{{ item.title }}<Icon name="arrow" :size="11" /></button>
          </div>
          <p v-else class="panel-note">在知识图谱中点击任意节点后，最近浏览会记录在这里。</p>
        </section>

        <section class="panel profile-panel">
          <div class="section-title"><h2>记录管理</h2><span>仅存于本机</span></div>
          <p class="panel-note">记录保存在当前浏览器中，不会上传服务器。可以导出 JSON 备份，或在演示前清空重新开始。</p>
          <div class="manage-actions">
            <button class="button secondary" @click="exportProgress"><Icon name="download" :size="16" />导出学习记录</button>
            <button class="button danger" :disabled="!hasRecords" @click="resetOpen = true"><Icon name="reset" :size="16" />清空学习记录</button>
          </div>
          <p class="panel-note">最近打开：{{ lastResource ? lastResource.title : '尚未打开学习资源' }}</p>
        </section>
      </aside>
    </div>

    <div v-if="resetOpen" class="modal-backdrop" @click.self="resetOpen = false">
      <section class="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <button class="modal-close icon-button" aria-label="关闭确认提示" @click="resetOpen = false"><Icon name="close" /></button>
        <span class="eyebrow">RESET LOCAL RECORDS</span>
        <h2 id="reset-title">要清空本机的学习记录吗？</h2>
        <p class="muted">已学资源、知识点进度、收藏、练习结果与错题都会从当前浏览器中移除，此操作无法撤销。此前导出的 JSON 文件不受影响。</p>
        <div class="confirm-actions">
          <button class="button secondary" @click="resetOpen = false">取消</button>
          <button class="button danger" @click="confirmReset"><Icon name="reset" :size="16" />确认清空</button>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<style scoped>
.profile-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-bottom:24px}
.profile-stat{display:flex;align-items:center;gap:14px;padding:18px 19px}
.profile-stat-body{min-width:0;flex:1}
.profile-stat-label{font-size:10px;color:#91a090;display:block;margin-bottom:4px}
.stat-track{display:block;height:4px;margin-top:9px}
.profile-stat-caption{display:block;font-size:9px;color:#a9b3a5;margin-top:7px}
.profile-layout{display:grid;grid-template-columns:minmax(0,1.85fr) minmax(280px,1fr);gap:21px;align-items:start}
.profile-main,.profile-aside{display:flex;flex-direction:column;gap:20px;min-width:0}
.profile-panel{padding:22px 23px}
.profile-panel .section-title{margin-bottom:14px}
.profile-panel h2{font-size:15px}
.profile-panel .section-title>span{font-size:9px;color:#a7b29f}
.panel-note{font-size:10px;line-height:1.9;color:#9aa79b;margin-top:12px}
.chapter-list{display:flex;flex-direction:column;gap:3px}
.chapter-row{display:flex;align-items:center;gap:14px;padding:9px 10px;border-radius:7px;text-align:left;width:100%;font-size:11px;color:#6f8272}
.chapter-row:hover{background:#f5f9f4}
.chapter-name{width:150px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chapter-bar{flex:1;min-width:40px;display:block}
.chapter-value{font-size:10px;color:#94a492;font-family:Georgia,serif;width:44px;text-align:right;flex-shrink:0}
.record-list{display:flex;flex-direction:column;gap:2px}
.record-row{display:flex;align-items:center;gap:12px;padding:11px 9px;border-bottom:1px solid #eef2ed;width:100%;text-align:left}
.record-row:last-child{border-bottom:none}
button.record-row{border-radius:7px}
button.record-row:hover{background:#f6faf5}
.record-mark{width:29px;height:29px;border-radius:8px;display:grid;place-items:center;flex-shrink:0;background:#f1f5f0;color:#9aa79c}
.record-mark.is-correct{background:#eaf4e7;color:#518b62}
.record-mark.is-wrong{background:#fbf0eb;color:#b5765d}
.record-mark.is-idle{background:#f1f5f0;color:#9aa79c}
.record-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.record-body strong{font-size:11.5px;font-weight:500;color:#4a6055;line-height:1.75;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.record-body small{font-size:9.5px;color:#a3ad9f}
.record-state{font-size:10px;color:#789a80;flex-shrink:0}
.record-state.is-wrong-text{color:#b5765d}
.fav-list{display:flex;flex-direction:column;gap:2px}
.fav-row{display:flex;align-items:center;gap:10px;padding:10px 8px;border-radius:7px;width:100%;text-align:left}
.fav-row:hover{background:#f5f9f4}
.fav-icon{width:30px;height:31px;border-radius:7px;background:#eaf3e7;color:#79a573;display:grid;place-items:center;flex-shrink:0}.fav-icon.external{background:#eceff7;color:#6f7bb0}
.fav-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.fav-body strong{font-size:11px;font-weight:500;color:#4a6055;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fav-body small{font-size:9px;color:#a3ad9f}
.fav-row>svg{color:#aab8a8}
.chip-list{display:flex;flex-wrap:wrap;gap:7px}
.manage-actions{display:flex;flex-direction:column;gap:9px;margin-top:14px}
.confirm-modal{max-width:450px;padding:31px 30px}
.confirm-modal h2{font-size:21px;font-weight:600;margin:14px 0 10px}
.confirm-modal .muted{font-size:11.5px}
.confirm-actions{display:flex;gap:10px;margin-top:24px}
.confirm-actions .button{flex:1}
@media(min-width:1550px){.profile-stats{gap:20px}.chapter-name{width:180px}}
@media(max-width:1200px){.profile-layout{grid-template-columns:minmax(0,1fr) 265px;gap:15px}.profile-panel{padding:20px 18px}.chapter-name{width:124px}.profile-stats{gap:12px}.profile-stat{padding:16px 14px;gap:11px}}
@media(max-width:1000px){.profile-layout{grid-template-columns:1fr}.profile-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){.profile-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.profile-stat{padding:14px 13px;gap:9px}.chapter-name{width:104px;font-size:10px}.chapter-row{gap:9px;padding:8px 6px}.record-body strong{font-size:11px}.profile-panel{padding:19px 16px}.page-heading>.tag{display:none}}
</style>
