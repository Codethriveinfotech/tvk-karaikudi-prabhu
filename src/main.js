import './style.css'
import { createIcons, Cpu, Layout, Smartphone, Users2, ClipboardList, MessageSquareMore, ShieldCheck, Clock, Target, Eye, Users, PhoneCall, Globe, MapPin, MessageSquarePlus, CheckCircle2, HandMetal, BrainCircuit, Shield, Quote, ArrowRight, Mic, ImagePlus, Search } from 'lucide'

// Initialize Lucide Icons
createIcons({
  icons: {
    Cpu,
    Layout,
    Smartphone,
    Users2,
    ClipboardList,
    MessageSquareMore,
    ShieldCheck,
    Clock,
    Target,
    Eye,
    Users,
    PhoneCall,
    Globe,
    MapPin,
    MessageSquarePlus,
    CheckCircle2,
    HandMetal,
    BrainCircuit,
    Shield,
    Quote,
    ArrowRight,
    Mic,
    ImagePlus,
    Search
  }
})

// Set Hero Image (already set in HTML, this is a fallback)
const heroImg = document.getElementById('hero-image')
if (heroImg) heroImg.src = '/vijaysir.png'

// Header Scroll Effect
const header = document.querySelector('#main-header') || document.querySelector('header')
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    header.classList.add('scrolled')
  } else {
    header.classList.remove('scrolled')
  }
})

// Reveal Animations on Scroll
const revealElements = document.querySelectorAll('[data-reveal]')
const revealOnScroll = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('active')
    }
  })
}, {
  threshold: 0.1
})

revealElements.forEach(el => revealOnScroll.observe(el))

// Smooth Scroll for Internal Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault()
    document.querySelector(this.getAttribute('href')).scrollIntoView({
      behavior: 'smooth'
    })
  })
})

// Grievance Form Handling
const API_BASE = import.meta.env.VITE_API_BASE || '';

const grievanceForm = document.getElementById('grievance-form')
const formSuccess = document.getElementById('form-success')
const descriptionInput = document.getElementById('citizen-description')
const photoInput = document.getElementById('citizen-photo')
const photoPreview = document.getElementById('photo-preview')
const photoPreviewImg = document.getElementById('photo-preview-img')
const photoFileName = document.getElementById('photo-file-name')
const removePhotoBtn = document.getElementById('remove-photo-btn')
const voiceTypeBtn = document.getElementById('voice-type-btn')
const voiceStatus = document.getElementById('voice-status')
const voiceLanguageSelect = document.getElementById('voice-language')
const categorySelect = document.getElementById('citizen-category')
const categoryShortcutButtons = document.querySelectorAll('.category-shortcuts button')
const descriptionCount = document.getElementById('description-count')
const useLocationBtn = document.getElementById('use-location-btn')
const locationStatus = document.getElementById('location-status')
const trackGrievanceForm = document.getElementById('track-grievance-form')
const trackIdInput = document.getElementById('track-id-input')
const trackStatusBtn = document.getElementById('track-status-btn')
const trackStatusResult = document.getElementById('track-status-result')

let selectedPhotoData = ''
let selectedPhotoName = ''
let selectedLocation = ''
let recognition = null
let isListening = false
let shouldKeepListening = false
let restartVoiceTimer = null
let lastTranscriptSnippet = ''
let lastTranscriptAt = 0

function normalizeTrackId(value) {
  return String(value || '').trim().toUpperCase()
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderTrackStatusResult(result, isError = false) {
  if (!trackStatusResult) return

  if (isError) {
    trackStatusResult.className = 'track-status-result error'
    trackStatusResult.innerHTML = `<p>${escapeHtml(result)}</p>`
    trackStatusResult.hidden = false
    return
  }

  const statusClass = String(result.status || 'Pending').toLowerCase().replace(/\s+/g, '-')
  const adminNotes = result.adminNotes?.trim() || 'Our team is reviewing your grievance and will update this section soon.'
  const createdAt = new Date(result.createdAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
  const category = result.category.charAt(0).toUpperCase() + result.category.slice(1)

  trackStatusResult.className = 'track-status-result success'
  trackStatusResult.innerHTML = `
    <div class="track-result-top">
      <div>
        <span class="track-result-label">TNX ID</span>
        <strong>${escapeHtml(result.trackId)}</strong>
      </div>
      <span class="track-result-badge ${statusClass}">${escapeHtml(result.status)}</span>
    </div>
    <div class="track-result-grid">
      <div>
        <span class="track-result-label">Name</span>
        <strong>${escapeHtml(result.name)}</strong>
      </div>
      <div>
        <span class="track-result-label">Area</span>
        <strong>${escapeHtml(result.constituency)}</strong>
      </div>
      <div>
        <span class="track-result-label">Category</span>
        <strong>${escapeHtml(category)}</strong>
      </div>
      <div>
        <span class="track-result-label">Submitted</span>
        <strong>${escapeHtml(createdAt)}</strong>
      </div>
    </div>
    <div class="track-result-notes">
      <span class="track-result-label">Latest Update</span>
      <p>${escapeHtml(adminNotes)}</p>
    </div>
  `
  trackStatusResult.hidden = false
}

function updateVoiceStatus(message) {
  if (voiceStatus) {
    voiceStatus.textContent = message
  }
}

function appendTranscript(transcript) {
  if (!descriptionInput || !transcript) return

  const existingText = descriptionInput.value.trim()
  descriptionInput.value = existingText ? `${existingText} ${transcript}` : transcript
  updateDescriptionCount()
  descriptionInput.focus()
}

function normalizeTranscriptSnippet(transcript) {
  return String(transcript || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function appendFinalTranscript(transcript) {
  const cleanTranscript = String(transcript || '').trim()
  if (!cleanTranscript) return

  const normalizedTranscript = normalizeTranscriptSnippet(cleanTranscript)
  const now = Date.now()
  const isDuplicate = normalizedTranscript === lastTranscriptSnippet && now - lastTranscriptAt < 4000

  if (isDuplicate) return

  lastTranscriptSnippet = normalizedTranscript
  lastTranscriptAt = now
  appendTranscript(cleanTranscript)
}

function clearVoiceRestartTimer() {
  if (!restartVoiceTimer) return
  window.clearTimeout(restartVoiceTimer)
  restartVoiceTimer = null
}

function startVoiceRecognition() {
  if (!recognition || isListening) return

  clearVoiceRestartTimer()
  recognition.lang = voiceLanguageSelect?.value || recognition.lang

  try {
    recognition.start()
  } catch (error) {
    if (error?.name !== 'InvalidStateError') {
      console.error('Error starting voice recognition:', error)
      updateVoiceStatus('Unable to start voice typing right now. Please try again.')
    }
  }
}

function stopVoiceRecognition() {
  shouldKeepListening = false
  clearVoiceRestartTimer()

  if (recognition && isListening) {
    recognition.stop()
  }
}

function updateDescriptionCount() {
  if (!descriptionInput || !descriptionCount) return

  const max = 500
  const length = descriptionInput.value.trim().length
  descriptionCount.textContent = `${Math.min(length, max)} / ${max}`
  descriptionCount.style.color = length >= 20 ? '#2e7d32' : '#777'
}

function setupDescriptionHelper() {
  if (!descriptionInput) return

  descriptionInput.addEventListener('input', updateDescriptionCount)
  updateDescriptionCount()
}

function syncCategoryShortcuts(value) {
  categoryShortcutButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.category === value)
  })
}

function setupCategoryShortcuts() {
  if (!categorySelect || categoryShortcutButtons.length === 0) return

  categoryShortcutButtons.forEach(button => {
    button.addEventListener('click', () => {
      categorySelect.value = button.dataset.category
      syncCategoryShortcuts(categorySelect.value)
      categorySelect.focus()
    })
  })

  categorySelect.addEventListener('change', () => syncCategoryShortcuts(categorySelect.value))
}

function setupLocationCapture() {
  if (!useLocationBtn || !locationStatus) return

  if (!navigator.geolocation) {
    useLocationBtn.disabled = true
    locationStatus.textContent = 'Location capture is not supported in this browser.'
    return
  }

  useLocationBtn.addEventListener('click', () => {
    locationStatus.textContent = 'Capturing current location...'
    useLocationBtn.disabled = true

    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords
      selectedLocation = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      locationStatus.textContent = `Location captured: ${selectedLocation}`
      useLocationBtn.disabled = false
    }, () => {
      locationStatus.textContent = 'Unable to capture location. Please type the area manually.'
      useLocationBtn.disabled = false
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    })
  })
}

function setupVoiceTyping() {
  if (!voiceTypeBtn || !descriptionInput) return

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    voiceTypeBtn.disabled = true
    voiceTypeBtn.title = 'Voice typing is not supported in this browser.'
    updateVoiceStatus('Voice typing is not supported in this browser. Try Chrome or Edge.')
    return
  }

  recognition = new SpeechRecognition()
  recognition.continuous = false
  recognition.interimResults = false
  recognition.lang = voiceLanguageSelect?.value || (navigator.language && navigator.language.startsWith('ta') ? 'ta-IN' : 'en-IN')

  recognition.addEventListener('start', () => {
    clearVoiceRestartTimer()
    isListening = true
    voiceTypeBtn.classList.add('is-listening')
    voiceTypeBtn.setAttribute('aria-pressed', 'true')
    const selectedLanguage = recognition.lang === 'ta-IN' ? 'Tamil' : 'English'
    updateVoiceStatus(`Listening in ${selectedLanguage}... speak now.`)
  })

  recognition.addEventListener('result', (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      if (event.results[i].isFinal) {
        appendFinalTranscript(event.results[i][0].transcript)
      }
    }
  })

  recognition.addEventListener('end', () => {
    isListening = false
    voiceTypeBtn.classList.remove('is-listening')
    voiceTypeBtn.setAttribute('aria-pressed', 'false')

    if (shouldKeepListening) {
      updateVoiceStatus('Listening paused briefly. Reconnecting...')
      restartVoiceTimer = window.setTimeout(() => {
        startVoiceRecognition()
      }, 250)
      return
    }

    updateVoiceStatus('Voice typing paused. Tap again to continue.')
  })

  recognition.addEventListener('error', (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      shouldKeepListening = false
      clearVoiceRestartTimer()
    }

    updateVoiceStatus(`Voice typing stopped: ${event.error}.`)
  })

  if (voiceLanguageSelect) {
    const browserDefault = navigator.language && navigator.language.startsWith('ta') ? 'ta-IN' : 'en-IN'
    voiceLanguageSelect.value = browserDefault

    voiceLanguageSelect.addEventListener('change', () => {
      recognition.lang = voiceLanguageSelect.value
      const selectedLanguage = recognition.lang === 'ta-IN' ? 'Tamil' : 'English'
      updateVoiceStatus(`Voice language set to ${selectedLanguage}. Tap Voice Type and speak.`)

      if (isListening) {
        stopVoiceRecognition()
      }
    })
  }

  voiceTypeBtn.addEventListener('click', () => {
    if (!recognition) return

    if (isListening) {
      stopVoiceRecognition()
    } else {
      shouldKeepListening = true
      startVoiceRecognition()
    }
  })
}

function resetPhotoUpload() {
  selectedPhotoData = ''
  selectedPhotoName = ''
  if (photoInput) photoInput.value = ''
  if (photoPreview) photoPreview.hidden = true
  if (photoPreviewImg) photoPreviewImg.removeAttribute('src')
  if (photoFileName) photoFileName.textContent = ''
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxSize = 1200
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = () => reject(new Error('Unable to read this image.'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('Unable to load this file.'))
    reader.readAsDataURL(file)
  })
}

function setupPhotoUpload() {
  if (!photoInput) return

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files && photoInput.files[0]
    if (!file) {
      resetPhotoUpload()
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.')
      resetPhotoUpload()
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Please upload an image smaller than 5 MB.')
      resetPhotoUpload()
      return
    }

    try {
      selectedPhotoData = await compressImage(file)
      selectedPhotoName = file.name

      if (photoPreviewImg) photoPreviewImg.src = selectedPhotoData
      if (photoFileName) photoFileName.textContent = file.name
      if (photoPreview) photoPreview.hidden = false
    } catch (error) {
      alert(error.message)
      resetPhotoUpload()
    }
  })

  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', resetPhotoUpload)
  }
}

setupVoiceTyping()
setupPhotoUpload()
setupDescriptionHelper()
setupCategoryShortcuts()
setupLocationCapture()

if (trackGrievanceForm) {
  trackGrievanceForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    const originalText = trackStatusBtn.innerHTML
    const trackId = normalizeTrackId(trackIdInput?.value)

    trackStatusBtn.innerHTML = '<span>Checking...</span>'
    trackStatusBtn.disabled = true

    try {
      const response = await fetch(`${API_BASE}/api/grievances/${encodeURIComponent(trackId)}`)
      const result = await response.json()

      if (!response.ok || !result.success) {
        renderTrackStatusResult(result.message || 'Unable to find this TNX ID.', true)
      } else {
        renderTrackStatusResult(result.data)
      }
    } catch (error) {
      console.error('Error checking grievance status:', error)
      renderTrackStatusResult('Unable to check status right now. Please try again in a moment.', true)
    } finally {
      trackStatusBtn.innerHTML = originalText
      trackStatusBtn.disabled = false
    }
  })
}

if (grievanceForm) {
  grievanceForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    const submitBtn = document.getElementById('submit-btn')
    const originalText = submitBtn.innerHTML
    
    // UI Feedback
    submitBtn.innerHTML = '<span class="tamil-text">சமர்ப்பிக்கிறது...</span> | Submitting...'
    submitBtn.disabled = true

    // Gather Form Data
    const name = document.getElementById('citizen-name').value.trim()
    const phone = document.getElementById('citizen-phone').value.trim()
    const constituency = document.getElementById('citizen-constituency').value.trim()
    const category = document.getElementById('citizen-category').value
    let description = document.getElementById('citizen-description').value.trim()
    const photoData = selectedPhotoData
    const photoName = selectedPhotoName

    if (selectedLocation) {
      description = `${description}\n\nCaptured location: ${selectedLocation}`
    }

    try {
      const response = await fetch(`${API_BASE}/api/grievances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, constituency, category, description, photoData, photoName })
      })

      const result = await response.json()

      if (result.success) {
        // Update the Tracking ID on success screen
        const successTrackId = document.getElementById('success-track-id')
        if (successTrackId) {
          successTrackId.textContent = result.trackId
        }
        
        // Switch view states
        grievanceForm.style.display = 'none'
        formSuccess.style.display = 'block'
        formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        alert('Problem submitting grievance: ' + (result.message || 'Unknown error'))
        submitBtn.innerHTML = originalText
        submitBtn.disabled = false
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('Unable to submit your request at this time. Please make sure the backend server is running.')
      submitBtn.innerHTML = originalText
      submitBtn.disabled = false
    }
  })
}

