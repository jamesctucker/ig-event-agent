<template>
  <div class="options-container">
    <header class="header">
      <h1>⚙️ Settings</h1>
      <p class="subtitle">Configure API keys and Google Sheets</p>
    </header>

    <div class="content">
      <form @submit.prevent="saveSettings" class="settings-form">
        <!-- OpenAI Configuration -->
        <section class="section">
          <h2>OpenAI Configuration</h2>
          <p class="description">
            Required for AI-powered event extraction from captions and images. Get your API key from
            <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a>.
          </p>

          <div class="form-group">
            <label for="openaiKey">OpenAI API Key</label>
            <input
              id="openaiKey"
              type="password"
              v-model="config.openaiApiKey"
              placeholder="sk-..."
              required
            />
          </div>
        </section>

        <!-- Google Sheets Configuration -->
        <section class="section">
          <h2>Google Sheets Configuration</h2>
          <p class="description">
            Configure Google Sheets to save extracted events. Follow the
            <a href="https://developers.google.com/sheets/api/quickstart/js" target="_blank"
              >setup guide</a
            >.
          </p>

          <div class="form-group">
            <label for="googleClientId">Google Client ID</label>
            <input
              id="googleClientId"
              type="text"
              v-model="config.googleClientId"
              placeholder="xxxxx.apps.googleusercontent.com"
            />
          </div>

          <div class="form-group">
            <label for="googleApiKey">Google API Key</label>
            <input
              id="googleApiKey"
              type="password"
              v-model="config.googleApiKey"
              placeholder="AIza..."
            />
          </div>

          <div class="form-group">
            <label for="googleSheetId">Google Sheet ID</label>
            <input
              id="googleSheetId"
              type="text"
              v-model="config.googleSheetId"
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
            />
            <p class="hint">
              Find the Sheet ID in the URL:
              docs.google.com/spreadsheets/d/<strong>[SHEET_ID]</strong>/edit
            </p>
          </div>
        </section>

        <!-- Actions -->
        <div class="actions">
          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Settings' }}
          </button>

          <button
            type="button"
            class="btn-secondary"
            @click="testConnection"
            :disabled="testing || !config.googleSheetId"
          >
            {{ testing ? 'Testing...' : 'Test Connection' }}
          </button>
        </div>

        <!-- Status Message -->
        <div v-if="statusMessage" :class="['status', statusType]">
          {{ statusMessage }}
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Storage } from '@plasmohq/storage'

interface Config {
  openaiApiKey: string
  googleClientId: string
  googleApiKey: string
  googleSheetId: string
}

const storage = new Storage()

const config = ref<Config>({
  openaiApiKey: '',
  googleClientId: '',
  googleApiKey: '',
  googleSheetId: ''
})

const saving = ref(false)
const testing = ref(false)
const statusMessage = ref('')
const statusType = ref<'success' | 'error' | 'info'>('info')

onMounted(async () => {
  // Load saved settings
  const saved = await storage.get<Config>('apiConfig')
  if (saved) {
    config.value = saved
  }
})

async function saveSettings() {
  try {
    saving.value = true

    // Save to storage
    await storage.set('apiConfig', config.value)

    showStatus('Settings saved successfully!', 'success')
  } catch (error) {
    console.error('Error saving settings:', error)
    showStatus('Failed to save settings', 'error')
  } finally {
    saving.value = false
  }
}

async function testConnection() {
  try {
    testing.value = true
    showStatus('Testing Google Sheets connection...', 'info')

    // Test the connection by trying to read the sheet
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.value.googleSheetId}?key=${config.value.googleApiKey}`
    )

    if (response.ok) {
      showStatus('✓ Google Sheets connection successful!', 'success')
    } else {
      const error = await response.json()
      showStatus(`Connection failed: ${error.error?.message || 'Unknown error'}`, 'error')
    }
  } catch (error) {
    console.error('Error testing connection:', error)
    showStatus('Connection test failed. Check your configuration.', 'error')
  } finally {
    testing.value = false
  }
}

function showStatus(message: string, type: 'success' | 'error' | 'info') {
  statusMessage.value = message
  statusType.value = type

  setTimeout(() => {
    if (type !== 'error') {
      statusMessage.value = ''
    }
  }, 5000)
}
</script>

<style lang="scss" scoped>
.options-container {
  max-width: 800px;
  margin: 0 auto;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.header {
  padding: 40px 20px;
  text-align: center;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  h1 {
    margin: 0 0 12px 0;
    font-size: 32px;
    font-weight: 600;
  }

  .subtitle {
    margin: 0;
    font-size: 16px;
    opacity: 0.9;
  }
}

.content {
  padding: 40px 20px;
}

.settings-form {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 32px;
  color: #333;
}

.section {
  margin-bottom: 32px;
  padding-bottom: 32px;
  border-bottom: 1px solid #e5e7eb;

  &:last-of-type {
    border-bottom: none;
  }

  h2 {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: #111;
  }

  .description {
    margin: 0 0 20px 0;
    font-size: 14px;
    color: #6b7280;
    line-height: 1.5;

    a {
      color: #667eea;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.form-group {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
  }

  input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    color: #111;
    transition: all 0.2s;

    &:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
  }

  .hint {
    margin: 6px 0 0 0;
    font-size: 12px;
    color: #6b7280;

    strong {
      color: #667eea;
      font-weight: 600;
    }
  }
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn-primary,
.btn-secondary {
  padding: 12px 24px;
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
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:not(:disabled):active {
    transform: translateY(0);
  }
}

.btn-primary {
  background: #667eea;
  color: #fff;
  flex: 1;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.status {
  margin-top: 20px;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;

  &.success {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  &.error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  &.info {
    background: #dbeafe;
    color: #1e40af;
    border: 1px solid #bfdbfe;
  }
}
</style>
