<template>
  <div class="photography">
    <div class="tags-container">
      <div 
        v-for="tag in tags" 
        :key="tag"
        :class="['tag', { active: selectedTag === tag }]"
        @click="selectedTag = tag"
      >
        {{ tag }}
      </div>
    </div>
    <div class="gallery">
      <div v-for="n in 8" :key="n" class="image-box">
        <!-- 图片将在这里添加 -->
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PhotographyView',
  data() {
    return {
      tags: ['Cat', 'Life', 'Travel'],
      selectedTag: 'Cat'
    }
  }
}
</script>

<style scoped>
.photography {
  padding: 40px 100px;
  background-color: #FFF7F2;
  min-height: 100vh;
}

.tags-container {
  display: flex;
  gap: 100px;
  justify-content: center;
  margin-top: 0px;
  margin-bottom: 0px;
  padding-top: 10px;
  padding-bottom: 10px;
}

.tag {
  font-family: 'Open Sans', sans-serif;
  font-weight: 400;
  font-size: 20px;
  color: #000000;
  cursor: pointer;
  transition: color 0.3s ease;
}

.tag.active {
  color: #40C575;
}

.gallery {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 20px;
  padding: 20px 0 ;
}

.image-box {
  aspect-ratio: 1;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

@media (max-width: 1200px) {
  .gallery {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .photography {
    padding: 20px;
  }

  .tags-container {
    gap: 40px;
  }

  .gallery {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
