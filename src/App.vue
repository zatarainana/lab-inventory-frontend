<template>
  <div class="app-container">
    <!-- Login View -->
    <div v-if="!isLoggedIn" class="login-container">
      <div class="login-box">
        <h2>Lab Inventory Login</h2>
        <form @submit.prevent="handleLogin">
          <input
            v-model="username"
            type="text"
            placeholder="Enter your username"
            required
          />
          <button type="submit">Enter Lab</button>
          <div v-if="loginError" class="error-message">{{ loginError }}</div>
        </form>
      </div>
    </div>

    <!-- Main App View -->
    <div v-else>
      <header>
        <div class="user-info">
          <span class="username">{{ username }} - {{ currentUser.fullName }}</span>
          <button @click="handleLogout" class="logout-btn">Logout</button>
        </div>
        <h1>Lab Inventory System</h1>
        <div class="search-container">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search reagents..."
            @input="searchReagents"
          />
          <button @click="searchReagents">Search</button>
        </div>
      </header>

      <div class="content-wrapper">
        <!-- Category Filters -->
        <div class="category-filters">
          <h3>Filter by Category:</h3>
          <div class="filter-buttons">
            <button
              v-for="category in categories"
              :key="category"
              @click="toggleCategory(category)"
              :class="{ active: selectedCategory === category }"
            >
              {{ category }} ({{ categoryCounts[category] || 0 }})
            </button>
            <button
              v-if="selectedCategory"
              @click="selectedCategory = null"
              class="clear-btn"
            >
              Clear Filter
            </button>
          </div>
        </div>

        <!-- Reagent List -->
        <main>
          <div v-if="loading" class="loading">Loading...</div>

          <div v-if="error" class="error">
            Error: {{ error }}
          </div>

          <div v-if="!loading && !error">
            <div v-if="filteredResults.length > 0" class="results-container">
              <h2>Showing {{ filteredResults.length }} reagents</h2>
              <div class="reagent-list">
                <div
                  v-for="reagent in filteredResults"
                  :key="reagent.id"
                  class="reagent-card"
                  @click="viewReagentDetails(reagent)"
                >
                  <h3>{{ reagent.name }}</h3>
                  <div class="reagent-meta">
                    <span class="supplier-code">{{ reagent.supplier_code }}</span>
                    <span class="quantity">{{ reagent.quantity }} {{ reagent.unit }}</span>
                  </div>
                  <div class="category">{{ reagent.category }}</div>
                </div>
              </div>
            </div>

            <div v-else class="no-results">
              No reagents found matching your criteria.
            </div>
          </div>
        </main>
      </div>

      <!-- Reagent Detail Modal -->
      <div v-if="selectedReagent" class="modal-overlay" @click.self="closeModal">
        <div class="modal-content">
          <button class="close-button" @click="closeModal">×</button>
          <h2>{{ selectedReagent.name }}</h2>

          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">Supplier Code:</span>
              <span class="detail-value">{{ selectedReagent.supplier_code }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Category:</span>
              <span class="detail-value">{{ selectedReagent.category }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Type:</span>
              <span class="detail-value">{{ selectedReagent.type }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Location:</span>
              <span class="detail-value">{{ selectedReagent.location }}{{ selectedReagent.sublocation ? `-${selectedReagent.sublocation}` : '' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span class="detail-value">{{ selectedReagent.status }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Quantity:</span>
              <span class="detail-value">
                {{ selectedReagent.quantity }} {{ selectedReagent.unit }}
                <div class="quantity-controls">
                  <button @click.stop="adjustQuantity(-1)" class="qty-btn minus">-</button>
                  <button @click.stop="adjustQuantity(1)" class="qty-btn plus">+</button>
                </div>
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Notes:</span>
              <span class="detail-value">
                <button
                    v-if="selectedReagent.notes"
                    @click.stop="deleteNote"
                    class="delete-note-btn"
                >
                  Delete Note
                </button>
                <textarea
                  v-model="newNote"
                  placeholder="Add new note..."
                ></textarea>
                <button @click.stop="addNote" class="add-note-btn">Add Note</button>
                <div v-if="selectedReagent.notes" class="existing-notes">
                  <h4>Current Notes:</h4>
                  <p>{{ selectedReagent.notes }}</p>
                </div>
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Last Updated:</span>
              <span class="detail-value">{{ formatDate(selectedReagent.last_updated) }}</span>
            </div>
          </div>

          <div class="history-section">
            <h3>Usage History</h3>
            <div v-if="selectedReagent.history && selectedReagent.history.length > 0" class="history-list">
              <div v-for="(entry, index) in selectedReagent.history" :key="index" class="history-entry">
                <span class="history-date">{{ formatDate(entry.timestamp) }}</span>
                <span class="history-user">{{ entry.user }}</span>
                <span class="history-action" :class="{ 'added': entry.change > 0, 'removed': entry.change < 0 }">
                  {{ entry.change > 0 ? '+' : '' }}{{ entry.change }} {{ selectedReagent.unit }}
                </span>
                <span class="history-notes" v-if="entry.notes">({{ entry.notes }})</span>
              </div>
            </div>
            <div v-else class="no-history">
              No usage history recorded yet
            </div>
          </div>

          <div class="datasheet-link">
            <a :href="selectedReagent.datasheet_url" target="_blank" rel="noopener noreferrer">
              View Datasheet ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'

// API configuration
const API_BASE_URL = 'https://lab-inventory-07gn.onrender.com'

// User database with usernames and full names
const USER_DATABASE = {
  labmate1: {
    fullName: "Lab Technician 1",
    role: "Senior Technician"
  },
  labmate2: {
    fullName: "Lab Technician 2",
    role: "Junior Technician"
  },
  labmate3: {
    fullName: "Research Assistant",
    role: "Cell Biology"
  },
  researcher1: {
    fullName: "Dr. Smith",
    role: "Principal Investigator"
  },
  admin: {
    fullName: "Admin User",
    role: "System Administrator"
  }
}

// Approved usernames derived from user database
const APPROVED_USERNAMES = Object.keys(USER_DATABASE)

// Reactive state
const username = ref('')
const isLoggedIn = ref(false)
const loginError = ref('')
const searchQuery = ref('')
const searchResults = ref([])
const selectedReagent = ref(null)
const selectedCategory = ref(null)
const loading = ref(false)
const error = ref(null)
const newNote = ref('')

// Computed properties
const currentUser = computed(() => {
  return USER_DATABASE[username.value.toLowerCase()] || {
    fullName: "Unknown User",
    role: "Guest"
  }
})

const categories = computed(() => {
  const allCategories = new Set()
  searchResults.value.forEach(reagent => {
    if (reagent.category) allCategories.add(reagent.category)
  })
  return Array.from(allCategories).sort()
})

const categoryCounts = computed(() => {
  const counts = {}
  searchResults.value.forEach(reagent => {
    if (reagent.category) {
      counts[reagent.category] = (counts[reagent.category] || 0) + 1
    }
  })
  return counts
})

const filteredResults = computed(() => {
  let results = searchResults.value

  // Apply category filter
  if (selectedCategory.value) {
    results = results.filter(reagent => reagent.category === selectedCategory.value)
  }

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    results = results.filter(reagent =>
      reagent.name.toLowerCase().includes(query) ||
      (reagent.supplier_code && reagent.supplier_code.toLowerCase().includes(query)) ||
      (reagent.category && reagent.category.toLowerCase().includes(query))
    )
  }

  return results
})

// Methods
const handleLogin = () => {
  const enteredUsername = username.value.trim()

  if (!enteredUsername) {
    loginError.value = 'Please enter a username'
    return
  }

  // Check against approved usernames
  const normalizedUsername = enteredUsername.toLowerCase()
  if (APPROVED_USERNAMES.includes(normalizedUsername)) {
    isLoggedIn.value = true
    username.value = normalizedUsername
    loginError.value = ''
    localStorage.setItem('labUsername', normalizedUsername)
    loadInventoryData()
  } else {
    loginError.value = 'Access denied. Please use a valid lab username.'
    username.value = ''
  }
}

const handleLogout = () => {
  isLoggedIn.value = false
  username.value = ''
  loginError.value = ''
  localStorage.removeItem('labUsername')
  searchResults.value = []
}

// Update the loadInventoryData method
const loadInventoryData = async () => {
  try {
    loading.value = true;
    error.value = null;

    // Fetch reagents
    const response = await fetch(`${API_BASE_URL}/reagents`);
    if (!response.ok) throw new Error("Failed to fetch reagents");

    const data = await response.json();

    // Handle both array and object responses
    const reagentsArray = Array.isArray(data) ? data : data.reagents || [];

    // Try to fetch history if endpoint exists
    let historyArray = [];
    try {
      const historyRes = await fetch(`${API_BASE_URL}/reagents/history`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        historyArray = Array.isArray(historyData) ? historyData : historyData.history || [];
      }
    } catch (historyError) {
      console.warn("Could not load history:", historyError);
    }

    // Merge data
    searchResults.value = reagentsArray.map(reagent => ({
      ...reagent,
      history: historyArray.filter(h => h.reagent_id === reagent.id)
    }));

  } catch (err) {
    error.value = `Error: ${err.message}`;
    console.error("Loading failed:", err);
  } finally {
    loading.value = false;
  }
};

const searchReagents = async () => {
  try {
    loading.value = true
    error.value = null

    if (!searchQuery.value.trim()) {
      await loadInventoryData()
      return
    }

    const response = await fetch(`${API_BASE_URL}/reagents`)
    const data = await response.json()
    const query = searchQuery.value.toLowerCase()

    searchResults.value = data.reagents.filter(reagent =>
      reagent.name.toLowerCase().includes(query) ||
      (reagent.supplier_code && reagent.supplier_code.toLowerCase().includes(query)) ||
      (reagent.category && reagent.category.toLowerCase().includes(query))
    )
  } catch (err) {
    error.value = `Failed to connect to backend: ${err.message}`
    console.error('Error searching reagents:', err)
  } finally {
    loading.value = false
  }
}

const viewReagentDetails = (reagent) => {
  selectedReagent.value = { ...reagent }
  newNote.value = ''
}

const closeModal = () => {
  selectedReagent.value = null
  newNote.value = ''
}

const toggleCategory = (category) => {
  selectedCategory.value = selectedCategory.value === category ? null : category
}

const adjustQuantity = async (change) => {
  try {
    if (!selectedReagent.value) return;

    // Optimistic UI update
    const originalQuantity = selectedReagent.value.quantity;
    const newQuantity = originalQuantity + change;
    selectedReagent.value.quantity = newQuantity;

    const response = await fetch(
      `${API_BASE_URL}/reagents/${selectedReagent.value.id}/quantity`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          change: change,
          user: username.value,
          notes: `Manual adjustment by ${username.value}`
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Update failed");
    }

    // Refresh data
    await loadInventoryData();

  } catch (err) {
    // Revert on error
    if (selectedReagent.value) {
      selectedReagent.value.quantity -= change;
    }
    error.value = `Update failed: ${err.message}`;
    console.error("Quantity adjustment error:", err);
  }
};

const deleteNote = async () => {
  if (!selectedReagent.value || !confirm("Delete this note permanently?")) return;

  try {
    // Optimistic update
    const oldNote = selectedReagent.value.notes;
    selectedReagent.value.notes = '';

    // Update server
    const response = await fetch(`${API_BASE_URL}/reagents/${selectedReagent.value.id}/notes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: username.value })
    });

    if (!response.ok) throw new Error("Server rejected deletion");

    // Refresh data
    await loadInventoryData();
    newNote.value = '';

  } catch (err) {
    // Revert on error
    if (selectedReagent.value) {
      selectedReagent.value.notes = oldNote;
    }
    alert("Failed to delete note");
    console.error("Deletion error:", err);
  }
};

const addNote = async () => {
  if (!selectedReagent.value || !newNote.value.trim()) return

  try {
    // Create history entry
    const historyEntry = {
      user: username.value,
      change: 0,
      timestamp: new Date().toISOString(),
      notes: newNote.value
    }

    // Update reagent data
    const updatedReagent = {
      ...selectedReagent.value,
      notes: newNote.value,
      last_updated: new Date().toISOString(),
      history: [...(selectedReagent.value.history || []), historyEntry]
    }

    // Update locally
    selectedReagent.value = updatedReagent

    // Update in search results
    const index = searchResults.value.findIndex(r => r.id === selectedReagent.value.id)
    if (index !== -1) {
      searchResults.value[index] = updatedReagent
    }

    // Send update to server
    await updateReagentOnServer(updatedReagent)

    // Clear note input
    newNote.value = ''

  } catch (err) {
    console.error('Error adding note:', err)
  }
}

const updateReagentOnServer = async (reagentData) => {
  try {
    // Prepare payload without history (handled separately)
    const { history, ...payload } = reagentData

    const response = await fetch(`${API_BASE_URL}/reagents/${reagentData.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error('Failed to update reagent')
    }

    // If there's history, add it separately
    if (history && history.length > 0) {
      const latestEntry = history[history.length - 1]
      await fetch(`${API_BASE_URL}/reagents/${reagentData.id}/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(latestEntry)
      })
    }

    return await response.json()
  } catch (err) {
    console.error('Error updating reagent on server:', err)
    throw err
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  return date.toLocaleString()
}

// Initialize
onMounted(() => {
  const savedUsername = localStorage.getItem('labUsername')
  if (savedUsername && APPROVED_USERNAMES.includes(savedUsername.toLowerCase())) {
    username.value = savedUsername
    isLoggedIn.value = true
    loadInventoryData()
  }
})
</script>

<style scoped>
/* Base Styles */
.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

/* Login Styles */
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f5f5f5;
}

.login-box {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  text-align: center;
  width: 100%;
  max-width: 400px;
}

.login-box h2 {
  color: #2c3e50;
  margin-bottom: 1.5rem;
}

.login-box input {
  width: 100%;
  padding: 10px 15px;
  margin-bottom: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.login-box button {
  width: 100%;
  padding: 12px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}

.login-box button:hover {
  background-color: #369f6b;
}

.error-message {
  color: #e74c3c;
  margin-top: 10px;
  font-size: 14px;
}

/* Main App Styles */
header {
  margin-bottom: 20px;
  position: relative;
}

h1 {
  color: #2c3e50;
  text-align: center;
  margin-bottom: 20px;
}

.user-info {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 15px;
}

.username {
  font-weight: bold;
}

.logout-btn {
  padding: 5px 10px;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.logout-btn:hover {
  background-color: #e0e0e0;
}

.search-container {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
}

.search-container input {
  padding: 10px 15px;
  width: 300px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.search-container button {
  padding: 10px 20px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.search-container button:hover {
  background-color: #369f6b;
}

/* Category Filters */
.category-filters {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f8f8;
  border-radius: 8px;
}

.category-filters h3 {
  margin-top: 0;
  margin-bottom: 10px;
}

.filter-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-buttons button {
  padding: 8px 12px;
  background-color: #e0e0e0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.filter-buttons button.active {
  background-color: #42b983;
  color: white;
}

.filter-buttons button:hover:not(.active) {
  background-color: #d0d0d0;
}

.clear-btn {
  background-color: #f5f5f5 !important;
  border: 1px solid #ddd !important;
}

/* Reagent List */
.results-container {
  margin-top: 20px;
}

.reagent-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.reagent-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.2s;
}

.reagent-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.reagent-card h3 {
  margin: 0 0 10px 0;
  color: #2c3e50;
}

.reagent-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
}

.category {
  font-size: 14px;
  color: #42b983;
  font-weight: bold;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
}

.close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 24px;
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin: 20px 0;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.detail-label {
  font-weight: bold;
  color: #555;
}

.detail-value {
  color: #333;
  text-align: right;
}

/* Quantity Controls */
.quantity-controls {
  display: inline-flex;
  gap: 5px;
  margin-left: 10px;
}

.qty-btn {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: none;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qty-btn.plus {
  background-color: #4CAF50;
  color: white;
}

.qty-btn.minus {
  background-color: #f44336;
  color: white;
}

.qty-btn:hover {
  opacity: 0.8;
}

/* Notes Section */
textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-height: 60px;
  margin-bottom: 8px;
  font-family: inherit;
}

.add-note-btn {
  padding: 8px 12px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 15px;
}

.add-note-btn:hover {
  background-color: #369f6b;
}

.existing-notes {
  background-color: #f8f8f8;
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
}

.existing-notes h4 {
  margin: 0 0 5px 0;
  font-size: 14px;
}

.existing-notes p {
  margin: 0;
  font-size: 14px;
}

/* History Section */
.history-section {
  margin-top: 30px;
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.history-section h3 {
  margin-top: 0;
}

.history-list {
  max-height: 200px;
  overflow-y: auto;
  margin-top: 10px;
}

.history-entry {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  font-size: 14px;
}

.history-date {
  color: #666;
  min-width: 150px;
}

.history-user {
  font-weight: bold;
  min-width: 100px;
}

.history-action {
  font-weight: bold;
}

.history-action.added {
  color: #4CAF50;
}

.history-action.removed {
  color: #f44336;
}

.history-notes {
  color: #666;
  font-style: italic;
}

.no-history {
  color: #666;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

/* Datasheet Link */
.datasheet-link {
  margin-top: 20px;
  text-align: center;
}

.datasheet-link a {
  color: #42b983;
  text-decoration: none;
  font-weight: bold;
  padding: 8px 16px;
  border: 1px solid #42b983;
  border-radius: 4px;
}

.datasheet-link a:hover {
  background-color: #42b983;
  color: white;
}

/* Utility Classes */
.loading, .no-results, .error {
  text-align: center;
  padding: 20px;
}

.error {
  color: #e74c3c;
}
</style>