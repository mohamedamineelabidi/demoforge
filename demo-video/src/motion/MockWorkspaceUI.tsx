import React from 'react';

/**
 * Vector UI mockup for the Remotion benchmark only.
 * Keeps edges crisp at 1.5x zoom. Not product evidence, not a screenshot,
 * and never a runtime_observed claim. Offline system fonts only.
 */
export const MockWorkspaceUI: React.FC<{isNotesActive: boolean}> = ({
  isNotesActive,
}) => {
  return (
    <div
      style={{
        width: 1600,
        height: 900,
        margin: '90px auto',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        boxShadow: '0 12px 36px rgba(0,0,0,0.08)',
        border: '1px solid #E0E2E6',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'Segoe UI', -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          height: 72,
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          backgroundColor: '#FFFFFF',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: '#0B57D0',
            }}
          />
          <span style={{fontSize: 20, fontWeight: 600, color: '#1F1F1F'}}>
            Sync and Strategy Call
          </span>
        </div>
        <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 24,
              backgroundColor: isNotesActive ? '#C2E7FF' : '#F2F2F2',
              color: isNotesActive ? '#001D35' : '#444746',
              fontWeight: 500,
              fontSize: 16,
            }}
          >
            <span>{'\u270E'}</span>
            <span>{isNotesActive ? 'Taking notes...' : 'Take notes'}</span>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: '#E0E2E6',
            }}
          />
        </div>
      </div>
      <div
        style={{
          flex: 1,
          padding: 24,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
        }}
      >
        <div
          style={{
            backgroundColor: '#1E1F20',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 22,
          }}
        >
          Conference Room A
        </div>
        <div
          style={{
            backgroundColor: '#2D2F31',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 22,
          }}
        >
          Remote Participant (Sara)
        </div>
      </div>
    </div>
  );
};
