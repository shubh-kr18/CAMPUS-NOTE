export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api'
export const FILE_BASE_URL = API_URL.replace(/\/api\/?$/, '')
export async function api(path, options = {}) {
  const token = localStorage.getItem('campus_token')
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Something went wrong. Please try again.')
  return data
}

export function uploadNote(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${API_URL}/notes`)
    const token = localStorage.getItem('campus_token')
    if (token) request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)) }
    request.onerror = () => reject(new Error('Network error while uploading the PDF.'))
    request.onload = () => {
      let data = {}
      try { data = JSON.parse(request.responseText) } catch {}
      if (request.status >= 200 && request.status < 300) resolve(data)
      else reject(new Error(data.message || 'Unable to upload the PDF.'))
    }
    request.send(formData)
  })
}

export function uploadAiDocument(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${API_URL}/ai/documents`)
    const token = localStorage.getItem('campus_token')
    if (token) request.setRequestHeader('Authorization', `Bearer ${token}`)
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)) }
    request.onerror = () => reject(new Error('Network error while uploading the PDF.'))
    request.onload = () => {
      let data = {}
      try { data = JSON.parse(request.responseText) } catch {}
      if (request.status >= 200 && request.status < 300) resolve(data)
      else reject(new Error(data.message || 'Unable to upload the PDF.'))
    }
    request.send(formData)
  })
}
