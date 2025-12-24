import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      // Default redirect to tree
      { path: '', redirect: '/tree' },

      // Main tabs
      {
        path: 'tree',
        name: 'tree',
        component: () => import('pages/TreePage.vue'),
        meta: { title: 'Passive Tree' },
      },
      {
        path: 'skills',
        name: 'skills',
        component: () => import('pages/SkillsPage.vue'),
        meta: { title: 'Skills' },
      },
      {
        path: 'items',
        name: 'items',
        component: () => import('pages/ItemsPage.vue'),
        meta: { title: 'Items' },
      },
      {
        path: 'calcs',
        name: 'calcs',
        component: () => import('pages/CalcsPage.vue'),
        meta: { title: 'Calculations' },
      },
      {
        path: 'config',
        name: 'config',
        component: () => import('pages/ConfigPage.vue'),
        meta: { title: 'Configuration' },
      },
      {
        path: 'notes',
        name: 'notes',
        component: () => import('pages/NotesPage.vue'),
        meta: { title: 'Notes' },
      },
    ],
  },

  // 404
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
