import CheckboxCanvas from './components/checkboxCanvas.vue'
import CheckboxMenu from './components/checkboxMenu.vue'

export default {
	name: 'app',
	components: {
		'checkbox-canvas': CheckboxCanvas,
		'checkbox-menu': CheckboxMenu
	},
	computed: {},
	created: function() {},
	methods: {},
	data() {
		return {
			options: {
				mirrorMode: true,
				isAdding: true,
				runBot: false,
				randomBot: false,
				doFill: false
			}
		}
	}
}
