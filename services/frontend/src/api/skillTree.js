import api from './client';

const skillTreeApi = {
  async getNodes({ race, archetype } = {}) {
    const params = new URLSearchParams();
    if (race) params.set('race', race);
    if (archetype) params.set('archetype', archetype);
    const qs = params.toString();
    const { data } = await api.get(`/api/skill-tree/nodes${qs ? `?${qs}` : ''}`);
    return data.nodes;
  },
  async createNode(payload) {
    const { data } = await api.post('/api/skill-tree/nodes', payload);
    return data.node;
  },
  async updateNode(id, payload) {
    const { data } = await api.put(`/api/skill-tree/nodes/${id}`, payload);
    return data.node;
  },
  async deleteNode(id) {
    await api.delete(`/api/skill-tree/nodes/${id}`);
  },

  async getEdges({ archetype } = {}) {
    const params = new URLSearchParams();
    if (archetype) params.set('archetype', archetype);
    const qs = params.toString();
    const { data } = await api.get(`/api/skill-tree/edges${qs ? `?${qs}` : ''}`);
    return data.edges;
  },
  async createEdge(payload) {
    const { data } = await api.post('/api/skill-tree/edges', payload);
    return data.edge;
  },
  async updateEdge(id, edge_type) {
    const { data } = await api.patch(`/api/skill-tree/edges/${id}`, { edge_type });
    return data.edge;
  },
  async deleteEdge(id) {
    await api.delete(`/api/skill-tree/edges/${id}`);
  },

  async getProgress() {
    const { data } = await api.get('/api/skill-tree/progress');
    return data.progress;
  },
  async unlock(nodeId) {
    const { data } = await api.post(`/api/skill-tree/progress/${nodeId}`);
    return data.progress;
  },
  async lock(nodeId) {
    await api.delete(`/api/skill-tree/progress/${nodeId}`);
  },

  async importTree(data) {
    await api.post('/api/skill-tree/import', data);
  },
};

export default skillTreeApi;
