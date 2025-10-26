<template>
  <div class="event-card">
    <div v-if="event.imageUrl" class="event-image">
      <img :src="event.imageUrl" :alt="event.name || 'Event image'" />
    </div>

    <div class="event-content">
      <h3 class="event-title">{{ event.name || 'Untitled Event' }}</h3>

      <div class="event-details">
        <div v-if="event.date" class="detail">
          <Calendar :size="16" class="icon" />
          <span>{{ event.date }}</span>
        </div>

        <div v-if="event.start" class="detail">
          <Clock :size="16" class="icon" />
          <span>{{ event.start }}</span>
        </div>

        <div v-if="event.location" class="detail">
          <MapPin :size="16" class="icon" />
          <span>{{ event.location }}</span>
        </div>

        <div v-if="event.organizer" class="detail">
          <Users :size="16" class="icon" />
          <span>{{ event.organizer }}</span>
        </div>

        <div v-if="event.cost" class="detail">
          <DollarSign :size="16" class="icon" />
          <span>{{ event.cost }}</span>
        </div>

        <div v-if="event.summary" class="detail summary">
          <FileText :size="16" class="icon" />
          <span>{{ event.summary }}</span>
        </div>
      </div>

      <div v-if="event.url" class="event-link">
        <a :href="event.url" target="_blank" rel="noopener"> View Original Post → </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Calendar, Clock, MapPin, Users, DollarSign, FileText } from 'lucide-vue-next'
interface Event {
  name?: string
  url?: string
  date?: string
  start?: string
  location?: string
  organizer?: string
  cost?: string
  summary?: string
  imageUrl?: string
}

interface Props {
  event: Event
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
.event-card {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
  }
}

.event-image {
  width: 100%;
  height: 150px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.event-content {
  padding: 16px;
}

.event-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.detail {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.95);

  .icon {
    opacity: 0.8;
    margin-top: 2px;
    flex-shrink: 0;
  }

  &.summary {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 12px;
    line-height: 1.5;

    span:not(.icon) {
      flex: 1;
    }
  }
}

.event-link {
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);

  a {
    color: #fff;
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    opacity: 0.9;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
      text-decoration: underline;
    }
  }
}
</style>
