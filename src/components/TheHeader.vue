<template>
  <header class="header">
    <div class="header-content">
      <div class="logo-container">
        <img src="@/assets/logo.png" alt="Logo" class="nav-logo" />
        <router-link to="/" class="logo">Yanfei Wang</router-link>
      </div>
      
      <button class="menu-toggle" @click="toggleMenu" :class="{ 'active': isMenuOpen }">
        <span></span>
        <span></span>
        <span></span>
      </button>

      <nav class="nav-links" :class="{ 'active': isMenuOpen }">
        <a 
          :class="{ 'active-work': isWorkRoute }" 
          class="work-link"
          @click.prevent
        >Work</a>
        <a href="#" @click.prevent="goToSection('research')">Research</a>
        <a href="#" @click.prevent="goToSection('interest')">Interest</a>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.nav-links {
  display: flex;
  gap: 40px;

  a {
    text-decoration: none;
    color: #000;
    font-weight: 500;
    font-family: 'Open Sans', sans-serif;
    transition: color 0.3s;
    cursor: pointer;

    &:hover {
      color: #40C575;
    }

    &.active-work {
      color: #40C575;
      font-weight: 600;
      cursor: default;
      pointer-events: none;
    }
  }
}
</style>

<script>
export default {
  name: 'TheHeader',
  computed: {
    isWorkRoute() {
      return this.$route.path.includes('/work/');
    }
  },
  data() {
    return {
      isMenuOpen: false
    }
  },
  methods: {
    toggleMenu() {
      this.isMenuOpen = !this.isMenuOpen;
    },
    goToSection(section) {
      // 如果不在首页，先返回首页
      if (this.$route.path !== '/') {
        this.$router.push('/').then(() => {
          setTimeout(() => {
            const element = document.getElementById(section);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
            }
          }, 100);
        });
      } else {
        // 如果在首页，直接滚动
        const element = document.getElementById(section);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }
}
</script>

<style scoped>

.logo-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nav-logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  background-color: #FFF7F2;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.header-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 200px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  @media (max-width: 1200px) {
    padding: 20px 100px;
  }

  @media (max-width: 768px) {
    padding: 20px;
  }
}

.logo {
  font-size: 20px;
  font-weight: 600;
  text-decoration: none;
  color: #000;
  font-family: 'Open Sans', sans-serif;
}

.nav-links {
  display: flex;
  gap: 40px;

  a {
    text-decoration: none;
    color: #000;
    font-weight: 500;
    font-family: 'Open Sans', sans-serif;
    transition: color 0.3s;
    cursor: pointer;

    &:hover {
      color: #40C575;
    }
  }

  /* 添加 Work 链接的激活状态 */
  .router-link-active {
    color: #40C575 !important;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    background-color: #FFF7F2;
    flex-direction: column;
    padding: 20px;
    gap: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);

    &.active {
      display: flex;
    }

    a {
      padding: 10px 20px;
    }
  }
}

.menu-toggle {
  display: none;
  flex-direction: column;
  justify-content: space-between;
  width: 30px;
  height: 20px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;

  span {
    display: block;
    width: 100%;
    height: 2px;
    background-color: #000;
    transition: all 0.3s;
  }

  &.active {
    span:nth-child(1) {
      transform: translateY(9px) rotate(45deg);
    }

    span:nth-child(2) {
      opacity: 0;
    }

    span:nth-child(3) {
      transform: translateY(-9px) rotate(-45deg);
    }
  }

  @media (max-width: 768px) {
    display: flex;
  }
}
</style>