import api from './client';

const artifactsApi = {
  // `type` isn't a column in the artifacts catalog — every row is an artifact.
  // It's stamped on here so a character sheet can group catalog entries coming
  // from both this service and equipment under one set of type headings.
  async getAll() {
    const { data } = await api.get('/api/artifacts/');
    return (data.artifacts ?? []).map((a) => ({ ...a, type: 'artifact' }));
  },
};

export default artifactsApi;
