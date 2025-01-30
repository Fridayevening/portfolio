<template>
  <div id="app">
    <TheHeader />
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script>
import TheHeader from './components/TheHeader.vue'

export default {
  name: 'App',
  components: {
    TheHeader
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  overflow-x: hidden;
}

.main-content {
  padding: 0;
  max-width: 100%;
  margin: 0;
}
</style>