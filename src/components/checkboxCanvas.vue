<template>
	<div ref="checkboxCanvas" class="checkboxCanvas">
		<input ref="checkboxReference" v-if="loading" type='checkbox' id='checkbox-reference'>
		<div class="checkboxContainer" @mousedown="mouseDown" @mouseup="mouseUp" @mouseleave="mouseLeave">
			<div class='checkboxRow' v-for="n in numCheckboxRows" :key="n">
				<input v-for="m in numCheckboxCols" :key="m" class='checkbox' type='checkbox' :data-x='m' :data-y='n' :id='`checkbox-${m}-${n}`' @change="onCheck" @mouseover="mouseOver">
			</div>
		</div>
	</div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'

export default {
	name: 'CheckboxCanvas',
	props: {
		options: {
			type: Object,
			required: true
		}
	},
	setup(props) {
		const checkboxCanvas = ref(null)
		const checkboxReference = ref(null)
		const loading = ref(true)
		const checkboxWidth = ref(0)
		const checkboxHeight = ref(0)
		const isPressed = ref(false)
		const botLoop = ref(null)
		const lastCheckedBox = ref({ x: 0, y: 0 })

		const width = computed(() => checkboxCanvas.value?.offsetWidth || 0)
		const height = computed(() => checkboxCanvas.value?.offsetHeight || 0)
		const numCheckboxCols = computed(() => loading.value ? 0 : Math.floor(width.value / checkboxWidth.value))
		const numCheckboxRows = computed(() => loading.value ? 0 : Math.floor(height.value / checkboxHeight.value))

		const init = () => {
			checkboxWidth.value = checkboxReference.value.offsetWidth
			checkboxHeight.value = checkboxReference.value.offsetWidth
			loading.value = false
		}

		const checkSingleBox = (x, y, isChecked) => {
			const checkbox = document.getElementById(`checkbox-${x}-${y}`)
			if (checkbox) checkbox.checked = isChecked
		}

		const checkMultiple = (x, y, isChecked) => {
			checkSingleBox(x, y, isChecked)
			lastCheckedBox.value = { x, y }
			if (props.options.mirrorMode) {
				checkSingleBox(numCheckboxCols.value + 1 - x, numCheckboxRows.value + 1 - y, isChecked)
				checkSingleBox(numCheckboxCols.value + 1 - x, y, isChecked)
				checkSingleBox(x, numCheckboxRows.value + 1 - y, isChecked)
			}
		}

		const onCheck = (event) => {
			const { target } = event
			const x = parseInt(target.dataset.x, 10)
			const y = parseInt(target.dataset.y, 10)
			checkMultiple(x, y, target.checked)
		}

		const mouseDown = () => { isPressed.value = true }
		const mouseUp = () => { isPressed.value = false }
		const mouseLeave = () => { mouseUp() }

		const mouseOver = (event) => {
			if (isPressed.value) {
				const x = parseInt(event.target.dataset.x, 10)
				const y = parseInt(event.target.dataset.y, 10)
				checkMultiple(x, y, props.options.isAdding)
			}
		}

		const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min)

		const startBot = () => {
			if (!botLoop.value) {
				botLoop.value = setInterval(() => {
					if (props.options.randomBot) {
						const randomX = lastCheckedBox.value.x + randomIntFromInterval(-1, 1)
						const randomY = lastCheckedBox.value.y + randomIntFromInterval(-1, 1)
						checkMultiple(randomX, randomY, props.options.isAdding)
					} else {
						const randomX = lastCheckedBox.value.x + 1
						const randomY = lastCheckedBox.value.y + 1
						checkMultiple(randomX, randomY, props.options.isAdding)
					}
				}, 50)
			}
		}

		const stopBot = () => {
			clearInterval(botLoop.value)
			botLoop.value = null
		}

		const fillAll = () => {
			for (let y = 0; y < numCheckboxRows.value; y++) {
				for (let x = 0; x < numCheckboxCols.value; x++) {
					checkSingleBox(x, y, true)
				}
			}
		}

		const clearAll = () => {
			for (let y = 0; y < numCheckboxRows.value; y++) {
				for (let x = 0; x < numCheckboxCols.value; x++) {
					checkSingleBox(x, y, false)
				}
			}
		}

		onMounted(() => {
			init()
		})

		watch(() => props.options.runBot, (value) => {
			value ? startBot() : stopBot()
		})

		watch(() => props.options.doFill, (value) => {
			value ? fillAll() : clearAll()
		})

		return {
			checkboxCanvas,
			checkboxReference,
			loading,
			numCheckboxCols,
			numCheckboxRows,
			onCheck,
			mouseDown,
			mouseUp,
			mouseLeave,
			mouseOver
		}
	}
}
</script>

<style scoped src='./checkboxCanvas.css'/>
