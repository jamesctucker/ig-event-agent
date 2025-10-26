<template>
  <div class="sidepanel-container">
    <header class="header">
      <div class="header-content">
        <h1><Calendar :size="28" class="header-icon" /> Event Extractor</h1>
        <p class="subtitle">Extract events from this Instagram collection</p>
      </div>
    </header>

    <div class="content">
      <div v-if="!isOnInstagram" class="warning">
        <AlertTriangle :size="48" class="warning-icon" />
        <p>Please open an Instagram saved collection</p>
        <p class="hint">Navigate to: instagram.com/[username]/saved/[collection]</p>
      </div>

      <div v-else class="form">
        <!-- Date Range Picker -->
        <div class="date-section">
          <h3>Select Date Range</h3>
          <div class="date-inputs">
            <div class="form-group">
              <label for="startDate">From</label>
              <input id="startDate" type="date" v-model="startDate" :disabled="loading" />
            </div>

            <div class="form-group">
              <label for="endDate">To</label>
              <input id="endDate" type="date" v-model="endDate" :disabled="loading" />
            </div>
          </div>
        </div>

        <!-- Extract Button -->
        <button class="btn-primary" :disabled="!canExtract" @click="extractEvents">
          <span v-if="!loading">Extract Events</span>
          <span v-else>Analyzing Posts...</span>
        </button>

        <!-- Progress Display -->
        <div v-if="progress.total > 0" class="progress-section">
          <div class="progress-header">
            <span>Processing Posts</span>
            <span class="progress-count">{{ progress.current }} / {{ progress.total }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
          </div>

          <!-- Current Post Preview -->
          <div v-if="currentPost" class="current-post">
            <img :src="currentPost.imageUrl" alt="Current post" />
            <div class="analyzing-badge">Analyzing...</div>
          </div>
        </div>

        <!-- Events Display -->
        <div v-if="extractedEvents.length > 0" class="events-section">
          <div class="section-header">
            <h3>
              <Sparkles :size="20" class="inline-icon" /> Found {{ extractedEvents.length }} Event{{
                extractedEvents.length !== 1 ? 's' : ''
              }}
            </h3>
            <div class="header-actions">
              <button v-if="!editMode" class="btn-text" @click="editMode = true">Edit</button>
              <button v-else class="btn-text" @click="editMode = false">Done</button>
              <button class="btn-text btn-danger" @click="clearEvents">Clear All</button>
            </div>
          </div>

          <div class="event-list">
            <div
              v-for="(event, index) in extractedEvents"
              :key="index"
              class="event-card"
              :class="{ 'edit-mode': editMode }"
            >
              <!-- Event Preview Image -->
              <div class="event-image" v-if="event.imageUrl">
                <img :src="event.imageUrl" alt="Event flyer" />
                <a :href="event.url" target="_blank" class="view-post-btn"> View Post → </a>
              </div>

              <!-- Event Details -->
              <div class="event-details">
                <template v-if="!editMode">
                  <h4>{{ event.name || 'Untitled Event' }}</h4>
                  <div class="event-meta">
                    <div v-if="event.date" class="meta-item">
                      <Calendar :size="16" class="icon" />
                      <span>{{ event.date }}</span>
                    </div>
                    <div v-if="event.start" class="meta-item">
                      <Clock :size="16" class="icon" />
                      <span>{{ event.start }}</span>
                    </div>
                    <div v-if="event.location" class="meta-item">
                      <MapPin :size="16" class="icon" />
                      <span>{{ event.location }}</span>
                    </div>
                    <div v-if="event.organizer" class="meta-item">
                      <Users :size="16" class="icon" />
                      <span>{{ event.organizer }}</span>
                    </div>
                    <div v-if="event.cost" class="meta-item">
                      <DollarSign :size="16" class="icon" />
                      <span>{{ event.cost }}</span>
                    </div>
                  </div>
                  <p v-if="event.summary" class="event-summary">{{ event.summary }}</p>
                </template>

                <!-- Edit Mode -->
                <template v-else>
                  <div class="edit-fields">
                    <input v-model="event.name" placeholder="Event name" class="edit-input" />
                    <input
                      v-model="event.date"
                      placeholder="Date (MM/DD/YYYY)"
                      class="edit-input"
                    />
                    <input v-model="event.start" placeholder="Start time" class="edit-input" />
                    <input v-model="event.location" placeholder="Location" class="edit-input" />
                    <input v-model="event.organizer" placeholder="Organizer" class="edit-input" />
                    <input v-model="event.cost" placeholder="Cost" class="edit-input" />
                    <textarea
                      v-model="event.summary"
                      placeholder="Summary"
                      class="edit-textarea"
                      rows="3"
                    ></textarea>
                    <button class="btn-remove" @click="removeEvent(index)">Delete</button>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <button class="btn-success" @click="saveToGoogleSheets" :disabled="saving">
            <span v-if="!saving">Save to Google Sheets</span>
            <span v-else><Loader2 :size="16" class="spinning-icon" /> Saving...</span>
          </button>
        </div>

        <!-- Empty State -->
        <div v-else-if="hasSearched && !loading" class="empty-state">
          <Search :size="64" class="empty-icon" />
          <p>No events found in the selected date range</p>
          <p class="hint">Try adjusting your date range or scrolling to load more posts</p>
        </div>

        <!-- Status Messages -->
        <div v-if="statusMessage" :class="['status', statusType]">
          {{ statusMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { sendToBackground } from '@plasmohq/messaging'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  DollarSign,
  Sparkles,
  AlertTriangle,
  Search,
  Loader2
} from 'lucide-vue-next'

interface ExtractedEvent {
  name?: string
  url?: string
  date?: string
  start?: string
  location?: string
  organizer?: string
  cost?: string
  summary?: string
  imageUrl?: string
  caption?: string
}

interface Progress {
  current: number
  total: number
}

interface Post {
  imageUrl: string
  caption: string
  postUrl: string
}

const isOnInstagram = ref(false)
const startDate = ref('')
const endDate = ref('')
const loading = ref(false)
const saving = ref(false)
const extractedEvents = ref<ExtractedEvent[]>([])
const progress = ref<Progress>({ current: 0, total: 0 })
const currentPost = ref<Post | null>(null)
const statusMessage = ref('')
const statusType = ref<'success' | 'error' | 'info'>('info')
const hasSearched = ref(false)
const editMode = ref(false)

const progressPercentage = computed(() => {
  if (progress.value.total === 0) return 0
  return (progress.value.current / progress.value.total) * 100
})

const canExtract = computed(() => {
  return startDate.value && endDate.value && !loading.value
})

onMounted(async () => {
  try {
    // Check if we're on Instagram
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const currentTab = tabs[0]

    console.log('Current tab URL:', currentTab?.url)

    if (currentTab?.url?.includes('instagram.com')) {
      isOnInstagram.value = true
      console.log('✅ On Instagram')
    } else {
      console.log('❌ Not on Instagram')
    }
  } catch (error) {
    console.error('Error checking tab:', error)
    // Assume we're on Instagram if we can't check
    isOnInstagram.value = true
  }

  // Set default date range (today + 14 days)
  const today = new Date()
  const twoWeeksLater = new Date(today)
  twoWeeksLater.setDate(today.getDate() + 14)

  startDate.value = today.toISOString().split('T')[0]
  endDate.value = twoWeeksLater.toISOString().split('T')[0]
})

async function extractEvents() {
  if (!canExtract.value) return

  try {
    loading.value = true
    hasSearched.value = true
    extractedEvents.value = []
    progress.value = { current: 0, total: 0 }
    currentPost.value = null
    showStatus('Starting extraction...', 'info')

    const response = (await sendToBackground({
      name: 'extractEvents',
      body: {
        collectionId: 'current',
        startDate: startDate.value,
        endDate: endDate.value
      }
    } as any)) as any

    if (response.success) {
      extractedEvents.value = response.events
      if (response.events.length > 0) {
        showStatus(
          `Successfully extracted ${response.events.length} event${
            response.events.length !== 1 ? 's' : ''
          }!`,
          'success'
        )
      } else {
        showStatus('No events found in this date range', 'info')
      }
    } else {
      showStatus(response.error || 'Failed to extract events', 'error')
    }
  } catch (error) {
    console.error('Error extracting events:', error)
    showStatus('Error extracting events', 'error')
  } finally {
    loading.value = false
    progress.value = { current: 0, total: 0 }
    currentPost.value = null
  }
}

async function saveToGoogleSheets() {
  try {
    saving.value = true
    showStatus('Saving to Google Sheets...', 'info')

    const response = (await sendToBackground({
      name: 'saveToSheets',
      body: {
        events: extractedEvents.value
      }
    } as any)) as any

    if (response.success) {
      showStatus('Successfully saved to Google Sheets!', 'success')
    } else {
      showStatus(response.error || 'Failed to save to Google Sheets', 'error')
    }
  } catch (error) {
    console.error('Error saving to sheets:', error)
    showStatus('Error saving to Google Sheets', 'error')
  } finally {
    saving.value = false
  }
}

function removeEvent(index: number) {
  extractedEvents.value.splice(index, 1)
}

function clearEvents() {
  const count = extractedEvents.value.length
  const eventWord = count === 1 ? 'event' : 'events'

  if (confirm(`Are you sure you want to clear all ${count} ${eventWord}? This cannot be undone.`)) {
    extractedEvents.value = []
    editMode.value = false
    hasSearched.value = false
    showStatus(`Cleared ${count} ${eventWord}`, 'info')
  }
}

function showStatus(message: string, type: 'success' | 'error' | 'info') {
  statusMessage.value = message
  statusType.value = type

  setTimeout(() => {
    statusMessage.value = ''
  }, 5000)
}

// Listen for progress updates
chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'progress') {
    progress.value = message.progress
  }
  if (message.type === 'currentPost') {
    currentPost.value = message.post
  }
})
</script>

<style lang="scss" scoped>
* {
  box-sizing: border-box;
}

.sidepanel-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    sans-serif;
  background: #f8f9fa;
  color: #1a1a1a;
  overflow: hidden;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;

  .header-content {
    h1 {
      margin: 0 0 4px 0;
      font-size: 24px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;

      .header-icon {
        flex-shrink: 0;
      }
    }

    .subtitle {
      margin: 0;
      font-size: 14px;
      opacity: 0.95;
    }
  }
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.warning {
  background: white;
  border: 2px solid #fbbf24;
  border-radius: 12px;
  padding: 24px;
  text-align: center;

  .warning-icon {
    margin-bottom: 12px;
    color: #fbbf24;
  }

  p {
    margin: 8px 0;
    color: #1a1a1a;

    &.hint {
      font-size: 14px;
      color: #6b7280;
    }
  }
}

.form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.date-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .date-inputs {
    display: flex;
    gap: 12px;
    flex-direction: row;
    @media (max-width: 480px) {
      flex-direction: column;
    }
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 13px;
    font-weight: 500;
    color: #6b7280;
  }

  input {
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: white;
    color: #1a1a1a;
    font-size: 14px;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: #f3f4f6;
    }
  }
}

.btn-primary,
.btn-success {
  padding: 14px 20px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:not(:disabled):active {
    transform: translateY(0);
  }
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  width: 100%;
}

.btn-text {
  background: none;
  border: none;
  color: #667eea;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.7;
  }

  &.btn-danger {
    color: #ef4444;

    &:hover {
      opacity: 0.8;
    }
  }
}

.btn-remove {
  background: #ef4444;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  margin-top: 8px;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.9;
  }
}

.progress-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
    color: #1a1a1a;

    .progress-count {
      color: #667eea;
    }
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      transition: width 0.3s ease;
    }
  }

  .current-post {
    margin-top: 16px;
    position: relative;
    border-radius: 8px;
    overflow: hidden;

    img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      display: block;
    }

    .analyzing-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(102, 126, 234, 0.95);
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      animation: pulse 2s infinite;
    }
  }
}

.events-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
      display: flex;
      align-items: center;
      gap: 8px;

      .inline-icon {
        flex-shrink: 0;
      }
    }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
  }

  .event-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

  .event-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.2s;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    &.edit-mode {
      background: #fef3c7;
      border-color: #fbbf24;
    }

    .event-image {
      position: relative;
      width: 100%;
      height: 200px;
      background: #e5e7eb;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .view-post-btn {
        position: absolute;
        bottom: 12px;
        right: 12px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        text-decoration: none;
        font-size: 12px;
        font-weight: 600;
        transition: background 0.2s;

        &:hover {
          background: rgba(0, 0, 0, 0.95);
        }
      }
    }

    .event-details {
      padding: 16px;

      h4 {
        margin: 0 0 12px 0;
        font-size: 18px;
        font-weight: 700;
        color: #1a1a1a;
      }

      .event-meta {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .meta-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #4b5563;

          .icon {
            flex-shrink: 0;
            opacity: 0.7;
          }
        }
      }

      .event-summary {
        margin: 12px 0 0 0;
        padding-top: 12px;
        border-top: 1px solid #e5e7eb;
        font-size: 14px;
        line-height: 1.6;
        color: #6b7280;
      }

      .edit-fields {
        display: flex;
        flex-direction: column;
        gap: 10px;

        .edit-input,
        .edit-textarea {
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          transition: border-color 0.2s;

          &:focus {
            outline: none;
            border-color: #667eea;
          }
        }

        .edit-textarea {
          resize: vertical;
        }
      }
    }
  }
}

.empty-state {
  background: white;
  border-radius: 12px;
  padding: 48px 24px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  .empty-icon {
    margin-bottom: 16px;
    opacity: 0.5;
    color: #6b7280;
  }

  p {
    margin: 8px 0;
    color: #1a1a1a;

    &.hint {
      font-size: 14px;
      color: #6b7280;
    }
  }
}

.status {
  margin-top: 16px;
  padding: 14px;
  border-radius: 10px;
  font-size: 14px;
  text-align: center;
  font-weight: 500;

  &.success {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #6ee7b7;
  }

  &.error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
  }

  &.info {
    background: #dbeafe;
    color: #1e40af;
    border: 1px solid #93c5fd;
  }
}

.spinning-icon {
  display: inline-block;
  animation: spin 1s linear infinite;
  vertical-align: middle;
  margin-right: 4px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;

  &:hover {
    background: #94a3b8;
  }
}
</style>
