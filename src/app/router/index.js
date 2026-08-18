import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/app/HomeView.vue'),
    meta: { title: 'Kooky' },
    children: [
      // 通讯录：我的数字员工（管理）+ 组织目录（真人 + 数字同事）
      {
        path: 'contacts/employees',
        name: 'ContactsEmployees',
        component: () => import('@/modules/contacts/ContactsEmployeesView.vue'),
        meta: { navKey: 'contacts-employees' },
      },
      {
        path: 'contacts-b/employee/:id',
        name: 'ContactsBEmployeeDetail',
        component: () => import('@/modules/contacts/ContactsEmployeeDetailView.vue'),
        meta: { navKey: 'contacts-b-employee' },
      },
      {
        path: 'contacts-b/org',
        name: 'ContactsBOrg',
        component: () => import('@/modules/contacts/ContactsOrgView.vue'),
        meta: { navKey: 'contacts-b-org' },
      },
      {
        path: 'contacts/org',
        name: 'ContactsOrg',
        component: () => import('@/modules/contacts/ContactsOrgView.vue'),
        meta: { navKey: 'contacts-org' },
      },
      {
        path: 'market/skill',
        name: 'MarketSkill',
        component: () => import('@/modules/market/skill/SkillMarketView.vue'),
        meta: { navKey: 'market-skill' },
      },
      {
        path: 'market/skill/:id',
        name: 'SkillDetail',
        component: () => import('@/modules/market/skill/components/SkillDetailView.vue'),
        meta: { navKey: 'market-skill' },
      },
      {
        path: 'market/avatar',
        name: 'MarketAvatar',
        component: () => import('@/modules/market/avatar/AvatarMarketView.vue'),
        meta: { navKey: 'market-avatar' },
      },
      {
        path: 'market/avatar/:id',
        name: 'AvatarDetail',
        component: () => import('@/modules/market/avatar/components/AvatarDetailView.vue'),
        meta: { navKey: 'market-avatar' },
      },
      {
        path: 'market/enterprise',
        name: 'MarketEnterprise',
        component: () => import('@/modules/market/enterprise/EnterpriseMarketView.vue'),
        meta: { navKey: 'market-enterprise' },
      },
      {
        path: 'market/enterprise/:id',
        name: 'EnterpriseDetail',
        component: () => import('@/modules/market/enterprise/components/EnterpriseDetailView.vue'),
        meta: { navKey: 'market-enterprise' },
      },
      {
        path: 'market/enterprise-mine/:id',
        name: 'EnterpriseMineDetail',
        component: () => import('@/modules/market/enterprise/components/EnterpriseUploadDetailView.vue'),
        meta: { navKey: 'market-enterprise' },
      },
      {
        path: 'market/my-uploads',
        name: 'MyUploads',
        component: () => import('@/modules/market/my-uploads/MyAssetsView.vue'),
        meta: { navKey: 'my-uploads' },
      },
      {
        path: 'market/my-uploads/skill/:id',
        name: 'MySkillDetail',
        component: () => import('@/modules/market/skill/components/SkillDetailView.vue'),
        meta: { navKey: 'market-skill' },
      },
      {
        path: 'market/my-uploads/agent/:id',
        name: 'MyAvatarDetail',
        component: () => import('@/modules/market/avatar/components/AvatarDetailView.vue'),
        meta: { navKey: 'market-avatar' },
      },
      {
        path: 'market/my-uploads/employee/:id',
        name: 'MyEmployeeDetail',
        component: () => import('@/modules/market/my-uploads/MyEmployeeDetail.vue'),
        meta: { navKey: 'my-uploads' },
      },
      {
        path: 'market/my-uploads/avatar/new',
        name: 'AvatarCreate',
        component: () => import('@/modules/market/my-uploads/components/SkillUploadView.vue'),
        meta: { navKey: 'market-avatar', uploadType: 'agent' },
      },
      {
        path: 'market/my-uploads/skill/new',
        name: 'SkillCreate',
        component: () => import('@/modules/market/my-uploads/components/SkillUploadView.vue'),
        meta: { navKey: 'market-skill', uploadType: 'skill' },
      },
      {
        path: 'market/my-uploads/avatar/:id/edit',
        name: 'AvatarEdit',
        component: () => import('@/modules/market/my-uploads/components/AvatarEditView.vue'),
        meta: { navKey: 'market-avatar' },
      },
      {
        path: 'market/my-uploads/skill/:id/edit',
        name: 'SkillEdit',
        component: () => import('@/modules/market/my-uploads/components/SkillEditView.vue'),
        meta: { navKey: 'market-skill' },
      },
      {
        path: 'market/my-uploads/:id',
        name: 'UploadDetail',
        component: () => import('@/modules/market/my-uploads/components/UploadDetailView.vue'),
        meta: { navKey: 'my-uploads' },
      },
      {
        path: 'market/my-hired',
        name: 'MyHired',
        component: () => import('@/modules/market/my-hired/MyHiredView.vue'),
        meta: { navKey: 'my-hired' },
      },
      {
        path: 'market/my-hired/:id',
        name: 'HiredDetail',
        component: () => import('@/modules/market/my-hired/components/HiredDetailView.vue'),
        meta: { navKey: 'my-hired' },
      },
      {
        path: 'market/my-hired/:id/edit',
        name: 'HiredEdit',
        component: () => import('@/modules/market/my-hired/components/AvatarEditView.vue'),
        meta: { navKey: 'my-hired' },
      },
      {
        path: 'market/enterprise-avatar',
        name: 'EnterpriseAvatar',
        component: () => import('@/modules/market/enterprise-avatar/EnterpriseAvatarView.vue'),
        meta: { navKey: 'enterprise-avatar' },
      },
      {
        path: 'market/enterprise-avatar/:id',
        name: 'EnterpriseAvatarDetail',
        component: () => import('@/modules/market/enterprise-avatar/components/EnterpriseAvatarDetailView.vue'),
        meta: { navKey: 'enterprise-avatar' },
      },
      {
        path: 'community',
        name: 'Community',
        component: () => import('@/modules/community/CommunityView.vue'),
        meta: { navKey: 'community' },
      },
      // DeerFlow 聊天模块
      {
        path: 'deerflow-chats',
        name: 'DeerflowThreadList',
        component: () => import('@/modules/deerflow-chat/components/DeerflowChatPanel.vue'),
        meta: { navKey: 'deerflow-chats' },
      },
      {
        path: 'deerflow-chats/:threadId',
        name: 'DeerflowChat',
        component: () => import('@/modules/deerflow-chat/components/DeerflowChatPanel.vue'),
        meta: { navKey: 'deerflow-chats' },
      },
    ],
  },
  {
    path: '/auth/callback',
    name: 'AuthCallback',
    component: () => import('@/modules/auth/components/AuthCallback.vue'),
    meta: { title: '登录中' },
  },
  {
    path: '/file-preview',
    name: 'FilePreview',
    component: () => import('@/modules/file/components/FilePreviewWindow.vue'),
    meta: { title: '文件预览' },
  },
  // Kode demo · 独立路由（绕过 HomeView/IM/auth gate，纯 UI 演示）
  {
    path: '/kode-demo',
    name: 'KodeDemo',
    component: () => import('@/modules/kode/KodeView.vue'),
    meta: { title: 'Kode Demo' },
  },
]

const isElectron = !!(window && window.electronAPI)

const router = createRouter({
  history: isElectron ? createWebHashHistory() : createWebHistory('/super-assistant'),
  routes,
})

router.beforeEach((to) => {
  if (to.meta?.title) {
    document.title = `Kooky`
  }
})

export default router
