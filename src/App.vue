<template>
	<div id="app">
		<CheckboxMenu :options="options" />
		<CheckboxCanvas :options="options" />
	</div>
</template>

<script>
import CheckboxCanvas from './components/checkboxCanvas.vue'
import CheckboxMenu from './components/checkboxMenu.vue'
import { reactive } from 'vue'

export default {
	name: 'App',
	components: {
		CheckboxCanvas,
		CheckboxMenu
	},
	setup() {
		const options = reactive({
			mirrorMode: true,
			isAdding: true,
			runBot: false,
			randomBot: false,
			doFill: false
		})

		return {
			options
		}
	}
}
</script>

<style src='./App.css'/>
