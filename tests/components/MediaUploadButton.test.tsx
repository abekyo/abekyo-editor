// @vitest-environment jsdom
//
// Smoke test for the per-clip media swap button used in the Properties panel.
// Verifies that clicking the visible button delegates to the hidden file
// input (the file picker pattern many of the editor's controls follow).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '../helpers/render';
import { MediaUploadButton } from '@/components/editor/MediaUploadButton';

describe('<MediaUploadButton />', () => {
  it('renders the upload affordance and forwards the click to the hidden file input', async () => {
    const onUpload = vi.fn();
    const { container } = render(<MediaUploadButton onUpload={onUpload} />);

    // Visible button is labelled by translation; the upload icon is decorative.
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent(/Upload image \/ video/i);

    // The hidden <input type="file" /> must accept image + video MIME types.
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput?.accept).toContain('image/*');
    expect(fileInput?.accept).toContain('video/mp4');

    // Spy on the hidden input's click — the button delegates here.
    const inputClick = vi.spyOn(fileInput!, 'click');
    const user = userEvent.setup();
    await user.click(button);
    expect(inputClick).toHaveBeenCalledTimes(1);

    // We did not actually pick a file, so onUpload should NOT have been
    // invoked — the upload only fires from the input's onChange handler.
    expect(onUpload).not.toHaveBeenCalled();
  });
});
