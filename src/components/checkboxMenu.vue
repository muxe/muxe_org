<template>
	<div class="menu">
		<input class='checkbox' type='checkbox' v-model="options.mirrorMode" title="Mirror Mode">
		<input class='checkbox' type='checkbox' v-model="options.isAdding" title="Paint/Eraser">
		<input class='checkbox' type='checkbox' v-model="options.runBot" title="Bot">
		<input class='checkbox' type='checkbox' v-model="options.randomBot" title="Random">
		<input class='checkbox' type='checkbox' v-model="options.doFill" title="Fill/Clear">
	</div>
</template>

<script src='./checkboxMenu.js'/>
<style scoped src='./checkboxMenu.css'/>
