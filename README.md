# Campus Note — IIIT Bhopal

A full-stack student platform for subject notes, attendance, schedules, clubs, and a future-ready AI chat interface.

## Stack

- Frontend: React, JSX, Vite, Tailwind CSS, React Router, Lucide icons
- Backend: Node.js, Express, MongoDB/Mongoose, JWT, bcryptjs, Multer

## Setup

1. Copy `.env.example` to `backend/.env` and set `MONGO_URI` and `JWT_SECRET`. Optionally copy `frontend/.env.example` to `frontend/.env`.
2. Install everything from the project root: `npm run install:all`
3. Start both apps: `npm run dev`
4. Open `http://localhost:5173`. The API runs on port 5002.

MongoDB must be running or `MONGO_URI` must point at an accessible MongoDB instance before the backend can start.

## Student Notes PDF management

Student Notes supports DSP, DSD, VLSI, Wireless Communication, and Microwave PDFs. Files are stored in `backend/uploads` (not MongoDB); the database only stores their secure metadata and path. PDFs are limited to 10 MB, must have a `.pdf` extension and PDF MIME type, and duplicate title/subject pairs are rejected.

Set `ADMIN_EMAILS` in `backend/.env` to a comma-separated list of authorized uploader emails, for example `ADMIN_EMAILS=admin@iiitbhopal.ac.in,teacher@iiitbhopal.ac.in`. Those accounts receive the upload and delete controls on their next login. Students can search, filter, view, and download PDFs but cannot upload or delete them.

## AI document upload API

`POST /api/ai/documents` accepts a single `multipart/form-data` field named `file`. It requires an existing JWT in `Authorization: Bearer <token>`, accepts only PDF files of up to 10 MB, verifies the PDF file signature, and returns:

```json
{
  "success": true,
  "documentId": "...",
  "filename": "lecture-notes.pdf",
  "fileSize": 123456,
  "uploadedAt": "..."
}
```

AI documents are stored privately in `backend/storage/ai-documents` by default; this directory is intentionally not served as a public URL and is gitignored. Use a persistent volume for that directory in deployment, or set `AI_DOCUMENT_STORAGE_DIR` to a persistent path. This endpoint stores files and metadata only—it does not perform embeddings, RAG, vector search, or LLM calls.

## Structure

`frontend/src` contains layouts, pages, components, services and local sample data. `backend` separates models, controllers, routes, middleware and configuration. Uploads are stored locally in `backend/uploads` and are intentionally gitignored.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Return a JWT |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/notes` | List/upload notes (JWT) |
| GET/DELETE | `/api/notes/:id` | Read/delete a note |
| GET | `/api/attendance` | Attendance data |
| GET | `/api/schedule` | Schedule data |
| GET | `/api/clubs`, `/api/clubs/:id` | Club data |
| POST | `/api/ai/chat` | Placeholder chat response |

All private endpoints require `Authorization: Bearer <token>`. Notes uploads only accept PDFs up to 10 MB.

## Future AI architecture

The intentionally simple `backend/services` boundary (and `frontend/src/services/aiService.js`) is the integration point for a future PDF processing / chunking / embedding / vector search / AI system. No AI, RAG, embeddings, or PDF analysis is implemented in this project.
