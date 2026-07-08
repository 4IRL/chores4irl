import { createPortal } from 'react-dom';

type ScreenBlankOverlayProps = {
    onWake: () => void;
};

export default function ScreenBlankOverlay({ onWake }: ScreenBlankOverlayProps) {
    return createPortal(
        <div
            className="fixed inset-0 bg-black z-[100]"
            onClick={onWake}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onWake();
                }
            }}
            tabIndex={0}
            data-testid="screen-blank-overlay"
            role="button"
            aria-label="Tap to wake screen"
        />,
        document.body,
    );
}
