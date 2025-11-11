import React from "react";
import Button from "./Button";

const ModelCard = ({
  model,
  isSelected,
  isDownloading,
  progress = 0,
  onDownload,
  onSelect,
  onDelete,
  showRadio = false,
  radioName = "model",
  radioValue,
  onRadioChange,
}) => {
  const renderRatingStars = (rating, maxRating = 10) => {
    const stars = 5;
    const filledStars = Math.round((rating / maxRating) * stars);

    return (
      <div className="flex gap-xxs">
        {[...Array(stars)].map((_, i) => (
          <svg
            key={i}
            className={`w-3 h-3 transition-colors duration-fast ${
              i < filledStars
                ? "text-mark-light dark:text-mark-dark fill-current"
                : "text-border-medium-light dark:text-border-medium-dark"
            }`}
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  return (
    <div
      className={`border rounded-lg p-xl transition-all duration-fast ${
        isSelected
          ? "border-primary-light dark:border-primary-dark bg-bg-surface-light dark:bg-bg-surface-dark border-2 shadow-md"
          : "border-border-light-light dark:border-border-light-dark hover:border-border-medium-light dark:hover:border-border-medium-dark bg-bg-surface-light dark:bg-bg-surface-dark border-2 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 flex items-center gap-xl">
          {/* Radio button for setup */}
          {showRadio && (
            <input
              type="radio"
              name={radioName}
              value={radioValue}
              checked={radioValue === model.id}
              onChange={onRadioChange}
              disabled={!model.downloaded}
              className="focus:outline-none"
            />
          )}

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-md mb-md">
              <h3 className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                {model.name}
              </h3>
              <span className="px-md py-xs bg-bg-secondary-light dark:bg-bg-secondary-dark text-text-body-light dark:text-text-body-dark text-xs rounded-sm transition-colors duration-fast">
                {model.language}
              </span>
              <span className="px-md py-xs bg-bg-secondary-light dark:bg-bg-secondary-dark text-text-body-light dark:text-text-body-dark text-xs rounded-sm transition-colors duration-fast">
                {model.size}
              </span>
              {model.recommended && (
                <span className="px-md py-xs bg-primary-light/10 dark:bg-primary-dark/10 text-primary-light dark:text-primary-dark text-xs rounded-sm font-medium transition-colors duration-fast">
                  Recommended
                </span>
              )}
              {isSelected && (
                <span className="flex items-center gap-xs text-xs text-success-light dark:text-success-dark transition-colors duration-fast">
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Selected
                </span>
              )}
            </div>

            {/* Ratings */}
            <div className="flex items-center gap-xl mb-md">
              <div className="flex items-center gap-sm">
                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
                  Speed
                </span>
                {renderRatingStars(model.speed)}
                <span className="text-xs font-medium text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  {model.speed}
                </span>
              </div>
              <div className="flex items-center gap-sm">
                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark transition-colors duration-fast">
                  Accuracy
                </span>
                {renderRatingStars(model.accuracy)}
                <span className="text-xs font-medium text-text-primary-light dark:text-text-primary-dark transition-colors duration-fast">
                  {model.accuracy}
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-text-body-light dark:text-text-body-dark mb-0 transition-colors duration-fast">
              {model.description}
            </p>

            {/* Download Progress */}
            {isDownloading && (
              <div className="mb-md mt-md">
                <div className="flex justify-between text-xs text-text-secondary-light dark:text-text-secondary-dark mb-sm transition-colors duration-fast">
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-bg-secondary-light dark:bg-bg-secondary-dark rounded-full h-1.5">
                  <div
                    className="bg-primary-light dark:bg-primary-dark h-1.5 rounded-full transition-all"
                    style={{ width: `${progress}%`, transitionDuration: '300ms' }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-md ml-xl">
          {!model.downloaded && !isDownloading && (
            <button
              className="p-md text-text-primary-light dark:text-text-primary-dark hover:text-primary-light dark:hover:text-primary-dark transition-colors duration-fast min-w-touch min-h-touch flex items-center justify-center"
              onClick={() => onDownload?.(model.id)}
              title="Download model"
            >
              <i className="ri-download-2-line text-lg"></i>
            </button>
          )}

          {model.downloaded && !isSelected && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSelect?.(model.id)}
            >
              Select
            </Button>
          )}

          {/* Delete button - simple bin icon */}
          {model.downloaded && (
            <button
              onClick={() => onDelete?.(model.id)}
              className="p-md text-text-tertiary-light dark:text-text-tertiary-dark hover:text-error-light dark:hover:text-error-dark transition-colors duration-fast min-w-touch min-h-touch flex items-center justify-center"
              title="Delete model"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelCard;
