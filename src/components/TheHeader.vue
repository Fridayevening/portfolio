<template>
  <header class="header">
    <div class="logo" @click="goToHome">
      <img src="@/assets/images/logo.png" alt="Logo" class="logo-image" />
      <div class="logo-text">
        <p>Yanfei</p>
        <p>Wang</p>
      </div>
    </div>
    <nav class="nav">
      <a @click.prevent="goToSection('selected-works')" :class="{ active: isWorkActive }">Work</a>
      <a @click.prevent="goToSection('research')">Research</a>
      <a @click.prevent="goToSection('interest')">Interest</a>
    </nav>
  </header>
</template>

<script>
export default {
  name: "TheHeader",
  computed: {
    // 检测是否当前路由是 Work 相关页面
    isWorkActive() {
      return this.$route.path.startsWith("/work");
    },
    // 检测当前是否在 HomeView
    isHomePage() {
      return this.$route.path === "/";
    },
  },
  methods: {
    // **返回 HomeView 并回到顶部**
    goToHome() {
      if (this.isHomePage) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        this.$router.push("/").then(() => {
          this.$nextTick(() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          });
        });
      }
    },

    // **点击导航栏 Work / Research / Interest**
    goToSection(sectionId) {
      if (this.isHomePage) {
        this.scrollToSection(sectionId);
      } else {
        this.$router.push("/").then(() => {
          this.waitForSection(sectionId);
        });
      }
    },

    // **等待 HomeView 渲染完成后再滚动**
    waitForSection(sectionId) {
      this.$nextTick(() => {
        setTimeout(() => {
          this.scrollToSection(sectionId);
        }, 300); // 确保 DOM 加载完成
      });
    },

    // **滚动到指定 section**
    scrollToSection(sectionId) {
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
  },
};
</script>

<style scoped>
.header {
  position: fixed; /* 固定在页面顶部 */
  top: 0;
  left: 0;
  width: 100%;
  z-index: 1000; /* 确保 header 处于最上层 */
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 100px; /* 适当调整 padding */
  background-color: rgba(255, 247, 242, 0.9); /* 半透明背景 */
  backdrop-filter: blur(10px); /* 添加模糊效果 */
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); /* 添加阴影提升层次感 */
}

body {
  padding-top: 80px; /* 确保内容不会被 header 遮挡 */
}

.logo {
  display: flex;
  align-items: center;
  cursor: pointer; /* 让 Logo 也可以点击 */
}

.logo-image {
  width: 40px; /* 适当调整 logo 尺寸 */
  height: auto;
  margin-right: 10px;
}

.logo-text {
  font-family: 'Open Sans', sans-serif;
  font-size: 14px;
  line-height: 1.2;
}

.nav a {
  margin-left: 40px;
  text-decoration: none;
  color: #333;
  font-family: 'Open Sans', sans-serif;
  transition: color 0.3s ease-in-out;
  cursor: pointer;
}

.nav a:hover {
  color: #40C575;
}

/* Work 页面高亮 */
.nav .active {
  color: #40C575 !important;
  font-weight: bold;
}
</style>
