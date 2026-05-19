import api from './api';

export async function fetchOpsDashboard() {
  const res = await api.get('/ops/dashboard');
  return res.data;
}

export async function fetchDependenciesHealth() {
  const res = await api.get('/ops/health');
  return res.data;
}
