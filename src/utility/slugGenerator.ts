
export const generateSlug = (title: string): string => {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')    // Remove non-word chars (except spaces and dashes)
        .replace(/[\s_-]+/g, '-')    // Replace spaces and underscores with dashes
        .replace(/^-+|-+$/g, '');    // Remove leading/trailing dashes
};
