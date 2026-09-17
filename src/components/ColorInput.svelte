<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    label: string;
    value: string;
    placeholder?: string;
    onchange: (value: string) => void;
  }

  let { label, value, placeholder = '', onchange }: Props = $props();
  let input: HTMLInputElement | undefined;

  $effect(() => {
    if (input && input.value !== value) input.value = value;
  });

  onMount(() => {
    let picker: { destroy(): void } | null = null;
    let disposed = false;
    void (async () => {
      const { default: ColorPicker } = await import(
        /* @vite-ignore */
        'https://cdn.jsdelivr.net/gh/wipeautcrafter/jscolorpicker@main/dist/colorpicker.min.js'
      );
      if (disposed || !input) return;
      const instance = new ColorPicker(input, {
        toggleStyle: 'input',
        submitMode: 'instant',
        enableAlpha: true,
        defaultFormat: 'hex',
        dialogPlacement: 'bottom-start',
      });
      instance.on('pick', (color) => {
        const next = color ? color.string('hex') : '';
        input.value = next;
        onchange(next);
      });
      picker = instance;
    })();

    return () => {
      disposed = true;
      picker?.destroy();
    };
  });

  function handleInput(event: Event) {
    onchange((event.currentTarget as HTMLInputElement).value);
  }
</script>

<label>
  {label}
  <input bind:this={input} type="text" {placeholder} value={value} oninput={handleInput} />
</label>
