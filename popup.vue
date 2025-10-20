<template>
  <div class="popup-container">
    <header class="header">
      <h1>📅 Instagram Event Agent</h1>
      <p class="subtitle">Extract events from your saved collections</p>
    </header>

    <div class="content">
      <div v-if="!isOnInstagram" class="warning">
        <p>⚠️ Please navigate to Instagram saved collections</p>
        <p class="hint">Go to: instagram.com/[your-username]/saved</p>
      </div>

      <div v-else class="form">
        <!-- Collection Selector -->
        <div class="form-group">
          <label for="collection">Select Collection</label>
          <select
            id="collection"
            v-model="selectedCollection"
            :disabled="loading || collections.length === 0"
            @change="onCollectionChange"
          >
            <option value="">
              {{ collections.length === 0 ? 'Loading collections...' : 'Choose a collection' }}
            </option>
            <option v-for="collection in collections" :key="collection.id" :value="collection.id">
              {{ collection.name }}
            </option>
          </select>
        </div>

        <!-- Date Range Picker -->
        <div class="form-group">
          <label for="startDate">Start Date</label>
          <input
            id="startDate"
            type="date"
            v-model="startDate"
            :disabled="!selectedCollection || loading"
          />
        </div>

        <div class="form-group">
          <label for="endDate">End Date</label>
          <input
            id="endDate"
            type="date"
            v-model="endDate"
            :disabled="!selectedCollection || loading"
          />
        </div>

        <!-- Extract Button -->
        <button class="btn-primary" :disabled="!canExtract" @click="extractEvents">
          {{ loading ? 'Extracting...' : 'Extract Events' }}
        </button>

        <!-- Progress Display -->
        <div v-if="progress.total > 0" class="progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
          </div>
          <p class="progress-text">
            Processing {{ progress.current }} of {{ progress.total }} posts
          </p>
        </div>

        <!-- Events Display -->
        <div v-if="extractedEvents.length > 0" class="events">
          <h3>Found {{ extractedEvents.length }} Events</h3>
          <div class="event-list">
            <div v-for="(event, index) in extractedEvents" :key="index" class="event-card">
              <h4>{{ event.name || 'Untitled Event' }}</h4>
              <p v-if="event.date"><strong>Date:</strong> {{ event.date }}</p>
              <p v-if="event.start"><strong>Start:</strong> {{ event.start }}</p>
              <p v-if="event.location"><strong>Location:</strong> {{ event.location }}</p>
              <p v-if="event.organizer"><strong>Organizer:</strong> {{ event.organizer }}</p>
              <p v-if="event.cost"><strong>Cost:</strong> {{ event.cost }}</p>
              <p v-if="event.summary" class="event-summary">{{ event.summary }}</p>
            </div>
          </div>

          <button class="btn-success" @click="saveToGoogleSheets" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save to Google Sheets' }}
          </button>
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

interface Collection {
  id: string
  name: string
  url: string
}

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

const isOnInstagram = ref(false)
const collections = ref<Collection[]>([])
const selectedCollection = ref('')
const startDate = ref('')
const endDate = ref('')
const loading = ref(false)
const saving = ref(false)
const extractedEvents = ref<ExtractedEvent[]>([])
const progress = ref<Progress>({ current: 0, total: 0 })
const statusMessage = ref('')
const statusType = ref<'success' | 'error' | 'info'>('info')

const progressPercentage = computed(() => {
  if (progress.value.total === 0) return 0
  return (progress.value.current / progress.value.total) * 100
})

const canExtract = computed(() => {
  return selectedCollection.value && startDate.value && endDate.value && !loading.value
})

onMounted(async () => {
  // Check if we're on Instagram
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const currentTab = tabs[0]

  if (currentTab?.url?.includes('instagram.com')) {
    isOnInstagram.value = true
    await loadCollections()
  }

  // Set default date range (current week)
  const today = new Date()
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)

  startDate.value = today.toISOString().split('T')[0]
  endDate.value = nextWeek.toISOString().split('T')[0]
})

async function loadCollections() {
  try {
    loading.value = true
    // @ts-ignore - Plasmo message type inference issue
    const response = await sendToBackground({
      name: 'getCollections'
    })

    if (response.success) {
      collections.value = response.collections
    } else {
      showStatus('Failed to load collections. Please refresh the page.', 'error')
    }
  } catch (error) {
    console.error('Error loading collections:', error)
    showStatus('Error loading collections', 'error')
  } finally {
    loading.value = false
  }
}

async function onCollectionChange() {
  if (selectedCollection.value) {
    // Navigate to the collection
    const collection = collections.value.find(c => c.id === selectedCollection.value)
    if (collection) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tabs[0]?.id) {
        await chrome.tabs.update(tabs[0].id, { url: collection.url })
      }
    }
  }
}

async function extractEvents() {
  if (!canExtract.value) return

  try {
    loading.value = true
    extractedEvents.value = []
    progress.value = { current: 0, total: 0 }
    showStatus('Starting extraction...', 'info')

    // @ts-ignore - Plasmo message type inference issue
    const response = await sendToBackground({
      name: 'extractEvents',
      body: {
        collectionId: selectedCollection.value,
        startDate: startDate.value,
        endDate: endDate.value
      }
    })

    if (response.success) {
      extractedEvents.value = response.events
      showStatus(`Successfully extracted ${response.events.length} events!`, 'success')
    } else {
      showStatus(response.error || 'Failed to extract events', 'error')
    }
  } catch (error) {
    console.error('Error extracting events:', error)
    showStatus('Error extracting events', 'error')
  } finally {
    loading.value = false
    progress.value = { current: 0, total: 0 }
  }
}

async function saveToGoogleSheets() {
  try {
    saving.value = true
    showStatus('Saving to Google Sheets...', 'info')

    // @ts-ignore - Plasmo message type inference issue
    const response = await sendToBackground({
      name: 'saveToSheets',
      body: {
        events: extractedEvents.value
      }
    })

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
})
</script>

<style lang="scss" scoped>
.popup-container {
  width: 400px;
  min-height: 500px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.header {
  padding: 24px 20px;
  text-align: center;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  h1 {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
  }

  .subtitle {
    margin: 0;
    font-size: 13px;
    opacity: 0.9;
  }
}

.content {
  padding: 20px;
}

.warning {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 16px;
  text-align: center;

  p {
    margin: 8px 0;

    &.hint {
      font-size: 12px;
      opacity: 0.8;
    }
  }
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 13px;
    font-weight: 500;
    opacity: 0.9;
  }

  select,
  input {
    padding: 10px 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    font-size: 14px;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: rgba(255, 255, 255, 0.4);
      background: #fff;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.btn-primary,
.btn-success {
  padding: 12px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &:not(:disabled):active {
    transform: translateY(0);
  }
}

.btn-primary {
  background: #fff;
  color: #667eea;
}

.btn-success {
  background: #10b981;
  color: #fff;
  margin-top: 12px;
}

.progress {
  margin-top: 16px;

  .progress-bar {
    width: 100%;
    height: 8px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      background: #10b981;
      transition: width 0.3s ease;
    }
  }

  .progress-text {
    margin-top: 8px;
    font-size: 12px;
    text-align: center;
    opacity: 0.9;
  }
}

.events {
  margin-top: 20px;

  h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
  }

  .event-list {
    max-height: 300px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;

      &:hover {
        background: rgba(255, 255, 255, 0.4);
      }
    }
  }

  .event-card {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 12px;

    h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 600;
    }

    p {
      margin: 4px 0;
      font-size: 12px;
      opacity: 0.9;

      strong {
        font-weight: 600;
      }

      &.event-summary {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 11px;
        line-height: 1.4;
      }
    }
  }
}

.status {
  margin-top: 16px;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  text-align: center;

  &.success {
    background: rgba(16, 185, 129, 0.2);
    border: 1px solid rgba(16, 185, 129, 0.4);
  }

  &.error {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  &.info {
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.4);
  }
}
</style>
