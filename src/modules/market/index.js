export { default as MarketLayout } from './MarketLayout.vue'

export const marketRoutes = {
  path: '/market',
  name: 'Market',
  component: () => import('./MarketLayout.vue'),
  redirect: '/market/skill',
  children: [
    {
      path: 'skill',
      name: 'MarketSkill',
      component: () => import('./skill/SkillMarketView.vue'),
      meta: { navKey: 'market-skill' },
    },
    {
      path: 'skill/:id',
      name: 'SkillDetail',
      component: () => import('./skill/components/SkillDetailView.vue'),
      meta: { navKey: 'market-skill' },
    },
    {
      path: 'avatar',
      name: 'MarketAvatar',
      component: () => import('./avatar/AvatarMarketView.vue'),
      meta: { navKey: 'market-avatar' },
    },
    {
      path: 'avatar/:id',
      name: 'AvatarDetail',
      component: () => import('./avatar/components/AvatarDetailView.vue'),
      meta: { navKey: 'market-avatar' },
    },
    {
      path: 'enterprise',
      name: 'MarketEnterprise',
      component: () => import('./enterprise/EnterpriseMarketView.vue'),
      meta: { navKey: 'market-enterprise' },
    },
    {
      path: 'enterprise/:id',
      name: 'EnterpriseDetail',
      component: () => import('./enterprise/components/EnterpriseDetailView.vue'),
      meta: { navKey: 'market-enterprise' },
    },
    {
      path: 'enterprise-mine/:id',
      name: 'EnterpriseMineDetail',
      component: () => import('./enterprise/components/EnterpriseUploadDetailView.vue'),
      meta: { navKey: 'market-enterprise' },
    },
    {
      path: 'my-uploads',
      name: 'MyUploads',
      component: () => import('./my-uploads/MyUploadsView.vue'),
      meta: { navKey: 'my-uploads' },
    },
    {
      path: 'my-uploads/agent/:id',
      name: 'UploadAgentDetail',
      component: () => import('./my-uploads/components/detail/AvatarDetailView.vue'),
      meta: { navKey: 'my-uploads' },
    },
    {
      path: 'my-uploads/:id',
      name: 'UploadDetail',
      component: () => import('./my-uploads/components/UploadDetailView.vue'),
      meta: { navKey: 'my-uploads' },
    },
    {
      path: 'my-hired',
      name: 'MyHired',
      component: () => import('./my-hired/MyHiredView.vue'),
      meta: { navKey: 'my-hired' },
    },
    {
      path: 'my-hired/:id',
      name: 'HiredDetail',
      component: () => import('./my-hired/components/HiredDetailView.vue'),
      meta: { navKey: 'my-hired' },
    },
    {
      path: 'my-hired/:id/edit',
      name: 'HiredEdit',
      component: () => import('./my-hired/components/AvatarEditView.vue'),
      meta: { navKey: 'my-hired' },
    },
    {
      path: 'enterprise-avatar',
      name: 'EnterpriseAvatar',
      component: () => import('./enterprise-avatar/EnterpriseAvatarView.vue'),
      meta: { navKey: 'enterprise-avatar' },
    },
    {
      path: 'enterprise-avatar/:id',
      name: 'EnterpriseAvatarDetail',
      component: () => import('./enterprise-avatar/components/EnterpriseAvatarDetailView.vue'),
      meta: { navKey: 'enterprise-avatar' },
    },
  ],
}
