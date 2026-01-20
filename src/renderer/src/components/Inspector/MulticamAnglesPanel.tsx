import React, { useEffect, useState } from 'react';
import { StoryNode, MulticamMember } from '../../../../shared/types';

interface MulticamAnglesPanelProps {
  node: StoryNode;
}

const MulticamAnglesPanel: React.FC<MulticamAnglesPanelProps> = ({ node }) => {
  const [multicamMembers, setMulticamMembers] = useState<MulticamMember[]>([]);
  const [activeAngle, setActiveAngle] = useState<string | undefined>(
    node.internal_state_map?.active_angle
  );

  useEffect(() => {
    const fetchMulticamMembers = async () => {
      if (node.asset_id) {
        const members = await window.electronAPI.multicamGetMembers(node.asset_id);
        setMulticamMembers(members);
      }
    };
    fetchMulticamMembers();
  }, [node.asset_id]);

  const handleAngleChange = async (memberMediaId: string) => {
    setActiveAngle(memberMediaId);
    await window.electronAPI.nodeSetAngle(node.id, memberMediaId);
  };

  if (!multicamMembers.length) {
    return (
      <div className="p-4 text-center text-text-tertiary">
        <p>No angles found for this multicam clip.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h4 className="text-xs font-semibold text-text-tertiary uppercase mb-2">
        Active Angle
      </h4>
      <div className="space-y-2">
        {multicamMembers.map((member) => (
          <label
            key={member.member_media_id}
            className="flex items-center space-x-2 cursor-pointer"
          >
            <input
              type="radio"
              name="multicam-angle"
              value={member.member_media_id}
              checked={activeAngle === member.member_media_id}
              onChange={() => handleAngleChange(member.member_media_id)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">
              {member.angle_label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default MulticamAnglesPanel;
