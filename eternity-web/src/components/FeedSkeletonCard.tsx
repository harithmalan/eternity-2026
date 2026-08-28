/** Same border/dimensions as a real FeedCard so nothing shifts once content arrives. */
export default function FeedSkeletonCard() {
  return (
    <div className="feed-card feed-skeleton" aria-hidden="true">
      <div className="feed-card-head">
        <span className="feed-skel feed-skel-avatar" />
        <div className="feed-card-head-text">
          <span className="feed-skel feed-skel-line" style={{ width: '55%' }} />
          <span className="feed-skel feed-skel-line" style={{ width: '30%', marginTop: 6 }} />
        </div>
      </div>
      <div className="feed-skel feed-skel-media" style={{ aspectRatio: '4 / 5' }} />
      <div className="feed-caption-wrap">
        <span className="feed-skel feed-skel-line" style={{ width: '92%', marginTop: 14 }} />
        <span className="feed-skel feed-skel-line" style={{ width: '68%', marginTop: 8 }} />
      </div>
    </div>
  );
}
