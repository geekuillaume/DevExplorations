import React from 'react';
import { graphql, StaticQuery } from 'gatsby';
import Img from 'gatsby-image';
import { rhythm } from '../utils/typography';

const render = data => {
  return (
    <div
      style={{
        display: 'flex',
        marginBottom: rhythm(2),
      }}
    >
      <Img
        fixed={data.file.childImageSharp.fixed}
        style={{
          marginRight: rhythm(1 / 2),
          marginBottom: 0,
          width: rhythm(3),
          height: rhythm(3),
          borderRadius: '50%',
        }}
        alt={`Guillaume Besson`}
      />
      <p style={{ maxWidth: 310 }}>
        Personal blog by{' '}
        <a href="https://twitter.com/geekuillaume">Guillaume Besson</a>.{' '}
        I&nbsp;talk about technical stuff, related to code or not.
      </p>
    </div>
  );
};

class Bio extends React.Component {
  render() {
    return (
      <StaticQuery
        query={graphql`
          query {
            file(
              sourceInstanceName: { eq: "assets" }
              relativePath: { eq: "profile-pic.jpg" }
            ) {
              childImageSharp {
                # Specify the image processing specifications right in the query.
                # Makes it trivial to update as your page's design changes.
                fixed(width: 150, height: 150) {
                  ...GatsbyImageSharpFixed_withWebp
                }
              }
            }
          }
        `}
        render={render}
      />
    );
  }
}

export default Bio;
