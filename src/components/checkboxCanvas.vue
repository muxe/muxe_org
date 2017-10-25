<template>
	<div ref="checkboxCanvas" class="checkboxCanvas">
		<input ref="checkboxReference" v-if="loading" type='checkbox' id='checkbox-reference'>
		<div class="checkboxContainer" v-on:mousedown="mouseDown" v-on:mouseup="mouseUp" @mouseleave="mouseLeave">
			<div class='checkboxRow' v-for="n in numCheckboxRows">
				<input v-for="m in numCheckboxCols" class='checkbox' type='checkbox' :data-x='m' :data-y='n' :id='"checkbox-" + m + "-" + n' @change="onCheck" @mouseover="mouseOver">
			</div>
		</div>
	</div>
</template>

<script src='./checkboxCanvas.js'/>
<style scoped src='./checkboxCanvas.css'/>
