// import { createRouter, createWebHistory } from 'vue-router'
// import HomeView from '../views/HomeView.vue'

// const routes = [
//   {
//     path: '/',
//     name: 'home',
//     component: HomeView
//   },
//   {
//     path: '/work',
//     name: 'work',
//     component: () => import('../views/works/WorkView.vue')
//   },
//   {
//     path: '/research',
//     name: 'research',
//     component: () => import('../views/research/ResearchView.vue')
//   },
//   {
//     path: '/interest',
//     name: 'interest',
//     component: () => import('../views/interests/InterestView.vue')
//   }
// ]

// const router = createRouter({
//   history: createWebHistory(process.env.BASE_URL),
//   routes
// })

// export default router


import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import Work1View from '../views/works/Work1View.vue'
import Work2View from '../views/works/Work2View.vue'
import Work3View from '../views/works/Work3View.vue'
import Work4View from '../views/works/Work4View.vue'
// import BlockchainView from '../views/interests/BlockchainView.vue'
// import PhotographyView from '../views/interests/PhotographyView.vue'
// import ConstructionView from '../views/interests/ConstructionView.vue'
// import ProductivityView from '../views/interests/ProductivityView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/work/w1',
    name: 'work1',
    component: Work1View
  },
  {
    path: '/work/w2',
    name: 'work2',
    component: Work2View
  },
  {
    path: '/work/w3',
    name: 'work3',
    component: Work3View
  },
  {
    path: '/work/w4',
    name: 'work4',
    component: Work4View
  },
  {
    path: '/research',
    name: 'research',
    component: () => import('../views/research/ResearchView.vue')
  },
  // {
  //   path: '/interest/blockchain',
  //   name: 'blockchain',
  //   component: BlockchainView
  // },
  // {
  //   path: '/interest/photography',
  //   name: 'photography',
  //   component: PhotographyView
  // },
  // {
  //   path: '/interest/construction',
  //   name: 'construction',
  //   component: ConstructionView
  // },
  // {
  //   path: '/interest/productivity',
  //   name: 'productivity',
  //   component: ProductivityView
  // }
]

// const router = createRouter({
//   history: createWebHistory(process.env.BASE_URL),
//   routes
// })

// export default router

const router = createRouter({
  history: createWebHistory('/portfolio/'),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;  // 如果有保存的位置，恢复到之前的滚动位置
    } else {
      return { top: 0 };  // 否则，滚动到顶部
    }
  },
});

export default router;