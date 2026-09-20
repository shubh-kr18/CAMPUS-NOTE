import { Navigate, Outlet } from 'react-router-dom'
export default function ProtectedRoute(){ return localStorage.getItem('campus_token') ? <Outlet/> : <Navigate to="/login" replace/> }
