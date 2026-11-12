// Fit an extra track only when it needs at most 20% shrinkage.
export function fitWallSize(space, target, gap, caption = 0, count = Infinity) {
    const tracks = Math.max(1, Math.min(count, Math.ceil((space + gap) / (target + caption + gap))));
    const fitted = (space - (tracks - 1) * gap) / tracks - caption;
    if (fitted >= target * .8) return Math.min(target, fitted);
    return Math.max(1, Math.min(target, space - caption));
}
